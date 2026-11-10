import type { AttentionItem, PlanningEvent, Task, User } from '@/types'
import { stockService } from './stock.service'
import { purchaseService } from './purchase.service'
import { deliveryService } from './delivery.service'
import { taskService } from './task.service'
import { financeService } from './finance.service'
import { supplierService } from './supplier.service'
import { productService } from './product.service'
import { procurementService } from './procurement.service'
import { receiptService } from './receipt.service'
import { planningService } from './task.service'
import { logisticsService } from './logistics.service'
import { formatCompactMoney } from '@/lib/utils'
import { DEMO_TODAY, opsToday } from '@/utils/helpers'

export interface TodaySignal {
  id: string
  label: string
  value: string | number
  trend: string
  trendUp: boolean
  tone: 'critical' | 'warning' | 'info' | 'success'
}

export interface StockWatchRow {
  productId: string
  warehouseId: string
  productName: string
  warehouseName: string
  quantity: number
  days: number
  tone: 'critical' | 'warning' | 'info'
}

export interface TodayBrief {
  queue: AttentionItem[]
  toHandle: AttentionItem[]
  toWatch: AttentionItem[]
  recommendations: AttentionItem[]
  tasks: Task[]
  activity: AttentionItem[]
  signals: TodaySignal[]
  watchStock: StockWatchRow[]
  prompts: string[]
  agenda: PlanningEvent[]
}

function scopedWarehouses(user: User): string[] | undefined {
  return user.warehouseIds.length ? user.warehouseIds : undefined
}

function rank(item: AttentionItem) {
  if (item.tone === 'critical') return 0
  if (item.tone === 'warning') return 1
  return 2
}

export const todayService = {
  async brief(user: User): Promise<TodayBrief> {
    const warehouseIds = scopedWarehouses(user)
    const [
      risks,
      delayed,
      deliveries,
      tasks,
      invoices,
      suppliers,
      products,
      stockRows,
      agenda,
      requests,
      receipts,
      inventories,
      notes,
    ] = await Promise.all([
      stockService.risks(warehouseIds),
      purchaseService.delayed(),
      deliveryService.list(),
      taskService.list(),
      financeService.invoices(),
      supplierService.list(),
      productService.list(),
      stockService.list(),
      planningService.list(),
      procurementService.list(),
      receiptService.list(),
      stockService.inventories(),
      logisticsService.shippingNotes(),
    ])

    const queue: AttentionItem[] = []
    const role = user.role

    if (role === 'WAREHOUSE_MANAGER' || role === 'ADMIN') {
      receipts
        .filter((item) => item.status !== 'validated' && (!warehouseIds || warehouseIds.includes(item.warehouseId)))
        .slice(0, 3)
        .forEach((item) => {
          queue.push({
            id: `rcp-${item.id}`,
            title: `Réceptionner ${item.code ?? item.id.toUpperCase()}`,
            detail: 'Contrôler l’arrivage, puis mettre le stock à jour.',
            tone: item.status === 'partial' ? 'warning' : 'info',
            primaryLabel: 'Ouvrir',
            primaryTo: `/procurement?tab=receipts&receipt=${item.id}`,
          })
        })
    }

    inventories
      .filter((item) => {
        if (item.status === 'completed') return false
        if (warehouseIds && !warehouseIds.includes(item.warehouseId)) return false
        if (role === 'WAREHOUSE_MANAGER') return item.status === 'in_progress' || item.status === 'pending_review'
        if (role === 'MANAGER' || role === 'ADMIN') return true
        return false
      })
      .slice(0, 2)
      .forEach((item) => {
        const gaps = (item.lines ?? []).filter((line) => line.counted !== line.expected).length
        queue.push({
          id: `inv-${item.id}`,
          title:
            item.status === 'pending_review'
              ? 'Valider les écarts d’inventaire'
              : 'Continuer l’inventaire',
          detail:
            item.status === 'pending_review'
              ? `${gaps} écart(s) en attente de validation.`
              : 'Comptage en cours — enregistrez puis soumettez les écarts.',
          tone: item.status === 'pending_review' ? 'warning' : 'info',
          primaryLabel: 'Ouvrir',
          primaryTo: `/stock?tab=inventory&session=${item.id}`,
        })
      })

    if (role === 'PROCUREMENT' || role === 'MANAGER' || role === 'ADMIN') {
      requests
        .filter((item) => {
          if (item.status !== 'approved') return false
          if (role === 'PROCUREMENT') return !item.assigneeId || item.assigneeId === user.id || item.assignedRole === 'PROCUREMENT'
          return true
        })
        .slice(0, 2)
        .forEach((item) => {
          queue.push({
            id: `da-${item.id}`,
            title: `Traiter ${item.code ?? item.id}`,
            detail: item.note || 'Demande approuvée — passer en commande.',
            tone: item.priority === 'high' ? 'warning' : 'info',
            primaryLabel: 'Ouvrir',
            primaryTo: `/procurement?request=${item.id}`,
          })
        })
    }

    if (role === 'PROCUREMENT' || role === 'MANAGER' || role === 'ADMIN' || role === 'FINANCE') {
      delayed.slice(0, 2).forEach((order) => {
        const supplier = suppliers.find((item) => item.id === order.supplierId)
        queue.push({
          id: `po-${order.id}`,
          title: `Retard ${order.id.toUpperCase()}`,
          detail: `${supplier?.name ?? 'Fournisseur'} n’a pas livré à la date prévue.`,
          tone: 'warning',
          primaryLabel: 'Ouvrir',
          primaryTo: `/procurement?tab=orders&order=${order.id}`,
        })
      })
    }

    if (role === 'DISPATCHER' || role === 'WAREHOUSE_MANAGER' || role === 'MANAGER') {
      notes
        .filter((item) => item.status === 'ready' && (!warehouseIds || warehouseIds.includes(item.warehouseId)))
        .slice(0, 2)
        .forEach((item) => {
          queue.push({
            id: `bl-${item.id}`,
            title: `Charger ${item.code}`,
            detail: `${item.client} — ${item.city}`,
            tone: 'info',
            primaryLabel: 'Ouvrir',
            primaryTo: `/logistics?tab=notes&note=${item.id}`,
          })
        })
    }

    if (role === 'DISPATCHER' || role === 'MANAGER' || role === 'ADMIN' || role === 'DRIVER') {
      deliveries
        .filter((item) => item.status === 'at_risk')
        .slice(0, 2)
        .forEach((item) => {
          queue.push({
            id: `dlv-${item.id}`,
            title: 'Livraison à risque',
            detail: `${item.client} — créneau sous tension.`,
            tone: 'warning',
            primaryLabel: 'Ouvrir',
            primaryTo: role === 'DRIVER' ? '/driver/today' : `/logistics?tab=deliveries&delivery=${item.id}`,
          })
        })
    }

    if (role === 'FINANCE') {
      invoices
        .filter((item) => item.status === 'overdue' || item.status === 'pending')
        .slice(0, 3)
        .forEach((item) => {
          queue.push({
            id: `inv-${item.id}`,
            title: `Facture ${item.id.toUpperCase()}`,
            detail: `${formatCompactMoney(item.amount)} — ${item.status === 'overdue' ? 'échéance dépassée' : 'en attente de règlement'}.`,
            tone: item.status === 'overdue' ? 'critical' : 'info',
            primaryLabel: 'Voir',
            primaryTo: '/finance',
          })
        })
    }

    if (canSeeStock(user)) {
      risks.slice(0, 3).forEach((risk) => {
        queue.push({
          id: `risk-${risk.product.id}-${risk.warehouse?.id}`,
          title: risk.days <= 3 ? 'Rupture imminente' : 'Stock à surveiller',
          detail: `${risk.product.name} à ${risk.warehouse?.name ?? ''} — ${Math.max(1, Math.round(risk.days))} j de couverture.`,
          tone: risk.days <= 3 ? 'critical' : 'warning',
          primaryLabel: 'Ouvrir',
          primaryTo: `/stock?article=${risk.product.id}&warehouse=${risk.warehouse?.id ?? ''}`,
        })
      })
    }

    const seen = new Set<string>()
    const unique = queue.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    unique.sort((a, b) => rank(a) - rank(b))
    const handle = unique.slice(0, 8)

    const myOpenTasks = tasks
      .filter((task) => task.assigneeId === user.id && task.status !== 'done')
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))

    const watchStock = risks.slice(0, 4).map((risk) => ({
      productId: risk.product.id,
      warehouseId: risk.warehouse?.id ?? '',
      productName: risk.product.name,
      warehouseName: risk.warehouse?.name ?? '',
      quantity: risk.available,
      days: Math.max(1, Math.round(risk.days)),
      tone: (risk.days <= 3 ? 'critical' : risk.days <= 7 ? 'warning' : 'info') as StockWatchRow['tone'],
    }))

    const stockValue = stockRows.reduce((sum, row) => {
      if (row.enabled === false) return sum
      if (warehouseIds && !warehouseIds.includes(row.warehouseId)) return sum
      const product = products.find((item) => item.id === row.productId)
      return sum + row.quantity * (product?.price ?? 0)
    }, 0)

    return {
      queue: handle,
      toHandle: handle,
      toWatch: [],
      recommendations: [],
      tasks: myOpenTasks.slice(0, 5),
      activity: [],
      signals: [
        {
          id: 'process',
          label: 'À traiter',
          value: handle.length,
          trend: handle.length ? 'dans l’ordre' : 'rien en attente',
          trendUp: !handle.length,
          tone: handle.some((item) => item.tone === 'critical') ? 'critical' : handle.length ? 'warning' : 'success',
        },
        {
          id: 'tasks',
          label: 'Tâches ouvertes',
          value: myOpenTasks.length,
          trend: 'vos actions',
          trendUp: true,
          tone: 'info',
        },
        {
          id: 'stock',
          label: 'Valeur stock',
          value: formatCompactMoney(stockValue),
          trend: 'périmètre actuel',
          trendUp: true,
          tone: 'success',
        },
      ],
      watchStock,
      prompts: [],
      agenda: agenda
        .filter((event) => event.date.startsWith(DEMO_TODAY))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }
  },
}

function canSeeStock(user: User) {
  return !['DRIVER', 'FINANCE'].includes(user.role)
}
