import type { AssistantInsight, AssistantMessage, ProposedAction, User } from '@/types'
import { uid, addDays, isoAt, parseQuantity, DEMO_TODAY } from '@/utils/helpers'
import { todayService } from './today.service'
import { stockService } from './stock.service'
import { purchaseService } from './purchase.service'
import { deliveryService } from './delivery.service'
import { supplierService } from './supplier.service'
import { productService } from './product.service'
import { procurementService } from './procurement.service'
import { purchaseService as orders } from './purchase.service'
import { logisticsService } from './logistics.service'
import { scoreSupplier } from './sourcing.service'
import { taskService, alertService } from './task.service'
import { warehouseService } from './warehouse.service'
import { replenishmentService, totalEstimatedCost } from './replenishment.service'
import { receiptService } from './receipt.service'
import { alertActionLabel, alertHref } from './alert.visibility'
import { stockRepository, stockLotRepository } from '@/repositories'

export type PageContext =
  | 'today'
  | 'stock'
  | 'procurement'
  | 'logistics'
  | 'finance'
  | 'tasks'
  | 'admin'
  | 'driver'
  | 'assistant'
  | 'other'

export interface AssistantQuery {
  text: string
  user: User
  page: PageContext
  confirm?: ProposedAction
}

export interface AssistantReply {
  content: string
  suggestions?: string[]
  proposedAction?: ProposedAction
  insights?: AssistantInsight[]
}

function msg(content: string, extra: Partial<AssistantReply> = {}): AssistantReply {
  return { content, ...extra }
}

function detectPage(path: string): PageContext {
  if (path.startsWith('/stock')) return 'stock'
  if (path.startsWith('/procurement') || path.startsWith('/purchasing')) return 'procurement'
  if (path.startsWith('/logistics')) return 'logistics'
  if (path.startsWith('/finance')) return 'finance'
  if (path.startsWith('/tasks') || path.startsWith('/planning')) return 'tasks'
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/driver')) return 'driver'
  if (path.startsWith('/assistant')) return 'assistant'
  if (path.startsWith('/today')) return 'today'
  return 'other'
}

function warehousesOf(user: User) {
  return user.warehouseIds.length ? user.warehouseIds : undefined
}

async function attention(user: User): Promise<AssistantReply> {
  const brief = await todayService.brief(user)
  const lines = [
    ...brief.toHandle.map((item) => `• ${item.title} — ${item.detail}`),
    ...brief.toWatch.map((item) => `• ${item.title} — ${item.detail}`),
  ]
  if (!lines.length) {
    return msg('Aucun problème détecté aujourd’hui. Vous pouvez souffler un peu.')
  }
  return msg(`Voici ce qui mérite votre attention :\n\n${lines.join('\n')}`, {
    insights: brief.toHandle.map((item) => ({
      title: item.title,
      detail: item.detail,
      tone: item.tone,
    })),
    suggestions: [
      'Quelles alertes sont ouvertes ?',
      'Quelles suggestions de réappro ?',
      'Quels produits vont être en rupture ?',
    ],
  })
}

async function stockouts(user: User): Promise<AssistantReply> {
  const risks = await stockService.risks(warehousesOf(user))
  if (!risks.length) return msg('Aucun produit n’est en risque de rupture sur votre périmètre.')
  const lines = risks.slice(0, 5).map((risk) => {
    const days = Math.max(1, Math.round(risk.days))
    return `• ${risk.product.name} à ${risk.warehouse?.name} — ${risk.available} unités, ~${days} jour${days > 1 ? 's' : ''}`
  })
  return msg(`Produits à surveiller :\n\n${lines.join('\n')}`, {
    insights: risks.slice(0, 3).map((risk) => ({
      title: risk.product.name,
      detail: `${risk.warehouse?.name ?? ''} — ${risk.available} u. · ~${Math.max(1, Math.round(risk.days))} j`,
      tone: (risk.days <= 3 ? 'critical' : 'warning') as AssistantInsight['tone'],
    })),
    suggestions: [
      'Quelles suggestions de réappro ?',
      'Prépare mes approvisionnements.',
      'Lots bientôt périmés ?',
    ],
  })
}

async function delayedOrders(): Promise<AssistantReply> {
  const list = await purchaseService.delayed()
  const suppliers = await supplierService.list()
  if (!list.length) return msg('Aucune commande n’est en retard pour le moment.')
  const lines = list.map((order) => {
    const supplier = suppliers.find((item) => item.id === order.supplierId)
    return `• ${order.id.toUpperCase()} — ${supplier?.name ?? ''} (attendue le ${order.expectedDate})`
  })
  return msg(`Commandes en retard :\n\n${lines.join('\n')}`, {
    insights: list.slice(0, 3).map((order) => {
      const supplier = suppliers.find((item) => item.id === order.supplierId)
      return {
        title: order.code ?? order.id.toUpperCase(),
        detail: `${supplier?.name ?? 'Fournisseur'} — attendue le ${order.expectedDate}`,
        tone: 'warning' as const,
      }
    }),
    suggestions: [
      'Quelles réceptions sont en attente ?',
      'Qui scorent le mieux ?',
      'Analyse mes fournisseurs.',
    ],
  })
}

async function whyStockDown(user: User): Promise<AssistantReply> {
  const movements = await stockRepository.movements()
  const products = await productService.list()
  const issued = movements.filter((item) => item.type === 'issue').slice(0, 5)
  const lines = issued.map((item) => {
    const product = products.find((row) => row.id === item.productId)
    return `• ${product?.name ?? item.productId} : −${item.quantity} (${item.note})`
  })
  const risks = await stockService.risks(warehousesOf(user))
  const extra = risks[0]
    ? `\n\nLe point le plus sensible est ${risks[0].product.name} : les sorties récentes dépassent le rythme de réappro.`
    : ''
  return msg(`Les sorties récentes expliquent surtout la baisse :\n\n${lines.join('\n')}${extra}`)
}

async function analyzeSuppliers(): Promise<AssistantReply> {
  let suppliers: Awaited<ReturnType<typeof supplierService.list>>
  let purchaseOrders: Awaited<ReturnType<typeof purchaseService.list>>
  let delayed: Awaited<ReturnType<typeof purchaseService.delayed>>
  try {
    ;[suppliers, purchaseOrders, delayed] = await Promise.all([
      supplierService.list(),
      purchaseService.list(),
      purchaseService.delayed(),
    ])
  } catch {
    return msg(
      'Le score fournisseurs nécessite le module Achats. Connectez-vous en acheteur (ex. Amina) ou ouvrez Approvisionnement → Référence.',
      { suggestions: ['Propose ordre et flotte pour la tournée.', 'Quelles livraisons présentent un risque ?'] },
    )
  }
  const active = suppliers.filter((item) => item.status === 'active')
  if (!active.length) return msg('Aucun fournisseur actif sur votre périmètre.')

  const scored = active
    .map((supplier) => {
      const perf = scoreSupplier(supplier, purchaseOrders)
      return { supplier, ...perf }
    })
    .sort((a, b) => b.reliability - a.reliability)

  const best = scored[0]
  const worst = scored[scored.length - 1]
  const delayedNames = delayed
    .map((order) => suppliers.find((item) => item.id === order.supplierId)?.name)
    .filter(Boolean)

  const lines = scored.slice(0, 6).map((item) => {
    const sample =
      item.orderSampleSize > 0
        ? ` · ponctualité ${item.onTimeRate}% (${item.orderSampleSize} OA)`
        : ' · pas encore d’historique OA'
    return `• ${item.supplier.name} — score ${item.reliability}% (déclaré ${item.declaredReliability}%)${sample} · délai ${item.supplier.leadTimeDays} j`
  })

  const headline =
    best.orderSampleSize > 0
      ? `${best.supplier.name} mène avec un score dynamique ${best.reliability}% (déclaré ${best.declaredReliability}%).`
      : `${best.supplier.name} arrive en tête sur la fiabilité déclarée (${best.reliability}%) — historique OA encore mince.`

  return msg(
    `${headline} ${
      worst && worst.supplier.id !== best.supplier.id
        ? `${worst.supplier.name} est le plus fragile (${worst.reliability}%). `
        : ''
    }${delayedNames.length ? `Retards en cours : ${[...new Set(delayedNames)].join(', ')}.` : ''}\n\n${lines.join('\n')}`,
    {
      insights: scored.slice(0, 3).map((item) => ({
        title: item.supplier.name,
        detail:
          item.orderSampleSize > 0
            ? `Score ${item.reliability}% · ponctualité ${item.onTimeRate}% · ${item.orderSampleSize} OA`
            : `Score ${item.reliability}% · déclaré ${item.declaredReliability}% · sans historique`,
        tone: (item.reliability < 70 ? 'warning' : 'info') as AssistantInsight['tone'],
      })),
      suggestions: ['Qui scorent le mieux ?', 'Que commander en priorité ?', 'Quelles commandes sont en retard ?'],
    },
  )
}

async function recommendSourcing(_user: User): Promise<AssistantReply> {
  let board: Awaited<ReturnType<typeof procurementService.board>>
  try {
    board = await procurementService.board({
      section: 'requests',
      filter: 'approved',
      page: 1,
      pageSize: 20,
    })
  } catch {
    return msg(
      'La reco sourcing nécessite le module Approvisionnement. Connectez-vous en acheteur (ex. Amina).',
      { suggestions: ['Qui scorent le mieux ?'] },
    )
  }
  const ready = board.readyToPurchase ?? []
  if (!ready.length) {
    return msg('Aucune DA prête à commander pour le moment. Validez une demande ou prenez-en une en charge.', {
      suggestions: ['Quels produits vont être en rupture ?', 'Analyse mes fournisseurs.'],
    })
  }

  const first = ready[0]
  const requestId = first.request?.id
  if (!requestId) return msg('Demande introuvable pour le sourcing.')

  let sourcing: Awaited<ReturnType<typeof procurementService.sourcing>>
  try {
    sourcing = await procurementService.sourcing([requestId])
  } catch {
    return msg('Impossible de calculer les offres pour cette DA. Réessayez depuis Approvisionnement → Référence.')
  }
  const offers = sourcing.offers ?? []
  if (!offers.length) {
    return msg(`Pas d’offre catalogue pour ${first.request?.code ?? first.code ?? requestId}.`, {
      suggestions: ['Analyse mes fournisseurs.'],
    })
  }

  const top = offers.slice(0, 3)
  const lines = top.map((offer) => {
    const punctual =
      offer.onTimeRate != null
        ? ` · ponctualité ${offer.onTimeRate}% (${offer.orderSampleSize ?? 0} OA)`
        : ' · sans historique OA'
    return `• ${offer.supplierName}${offer.recommended ? ' (reco)' : ''} — score ${Math.round(offer.score)} · fiabilité ${offer.reliability}%${punctual} · ${offer.leadTimeDays} j · ${Math.round(offer.amount)} MAD`
  })
  const reasons = (top[0]?.reasons ?? []).slice(0, 4).map((reason) => `  · ${reason}`)

  return msg(
    `Pour ${first.request?.code ?? first.code ?? requestId}, référence interne (prix · délai · ponctualité OA) :\n\n${lines.join('\n')}${
      reasons.length ? `\n\nMotifs reco :\n${reasons.join('\n')}` : ''
    }\n\nOuvrez Approvisionnement → Référence pour créer l’OA sans devis.`,
    {
      insights: top.map((offer) => ({
        title: offer.supplierName,
        detail: `Score ${Math.round(offer.score)} · fiabilité ${offer.reliability}% · ${offer.leadTimeDays} j`,
        tone: 'info' as const,
      })),
      suggestions: ['Analyse mes fournisseurs.', 'Quelles commandes sont en retard ?'],
    },
  )
}

async function assistRouteSummary(user: User): Promise<AssistantReply> {
  const warehouseId = user.warehouseIds[0]
  let notes: Awaited<ReturnType<typeof logisticsService.shippingNotes>>
  try {
    notes = await logisticsService.shippingNotes()
  } catch {
    return msg(
      'La suggestion de tournée nécessite le module Logistique. Connectez-vous en dispatch (ex. Nadia).',
      { suggestions: ['Qui scorent le mieux ?'] },
    )
  }
  const readyNotes = notes
    .filter((note) => ['ready', 'loaded'].includes(note.status))
    .filter((note) => !warehouseId || note.warehouseId === warehouseId)
    .slice(0, 5)

  if (!readyNotes.length) {
    return msg('Aucun bon prêt à enchaîner sur une tournée. Préparez des BL ou changez d’entrepôt.', {
      suggestions: ['Quelles livraisons présentent un risque ?'],
    })
  }

  let result: Awaited<ReturnType<typeof logisticsService.assistRoute>>
  try {
    result = await logisticsService.assistRoute({
      warehouseId: warehouseId || readyNotes[0].warehouseId || '',
      date: DEMO_TODAY,
      stops: readyNotes.map((note) => ({
        key: note.id,
        shippingNoteId: note.id,
        city: note.city,
        client: note.client,
        status: 'prepared' as const,
      })),
    })
  } catch {
    return msg('Impossible de calculer l’ordre & flotte pour le moment. Réessayez depuis Logistique → Nouvelle tournée.')
  }

  const orderLines = result.stops.slice(0, 5).map((stop) => {
    const risk = stop.status === 'at_risk' ? ' · priorité risque' : ''
    return `• ${stop.sequence}. ${stop.client || stop.shippingNoteId}${stop.city ? ` (${stop.city})` : ''}${risk}`
  })
  const driver = result.drivers.find((item) => item.recommended) ?? result.drivers[0]
  const vehicle = result.vehicles.find((item) => item.recommended) ?? result.vehicles[0]
  const reasons = (result.reasons ?? []).slice(0, 4).map((reason) => `· ${reason}`)

  return msg(
    `Suggestion dispatch (règles urgence · ville · proximité — pas une optimisation TSP) :\n\n${orderLines.join('\n')}\n\n` +
      `${driver ? `Chauffeur : ${driver.name}` : 'Chauffeur : à choisir'}${vehicle ? ` · Véhicule : ${vehicle.name}` : ''}` +
      `${result.distanceKm ? ` · ~${result.distanceKm} km` : ''}` +
      `${reasons.length ? `\n\n${reasons.join('\n')}` : ''}` +
      `\n\nOuvrez Logistique → Nouvelle tournée → « Proposer ordre & flotte » pour appliquer.`,
    {
      insights: [
        ...(driver
          ? [{ title: driver.name, detail: (driver.reasons ?? []).slice(0, 2).join(' · ') || 'Chauffeur recommandé', tone: 'info' as const }]
          : []),
        ...(vehicle
          ? [
              {
                title: vehicle.name,
                detail: (vehicle.reasons ?? []).slice(0, 2).join(' · ') || 'Véhicule recommandé',
                tone: 'info' as const,
              },
            ]
          : []),
      ],
      suggestions: ['Quelles livraisons présentent un risque ?', 'Qu’est-ce qui nécessite mon attention aujourd’hui ?'],
    },
  )
}

async function deliveryRisks(user: User): Promise<AssistantReply> {
  const list = await deliveryService.list()
  const scoped = user.driverId ? list.filter((item) => item.driverId === user.driverId) : list
  const risky = scoped.filter((item) => item.status === 'at_risk' || item.status === 'failed')
  if (!risky.length) return msg('Aucune livraison à risque sur votre périmètre.')
  const lines = risky.map(
    (item) => `• ${item.client} (${item.city}) — ${item.notes ?? 'retard probable'}`,
  )
  const head = risky[0]
  return msg(`Livraisons à risque :\n\n${lines.join('\n')}`, {
    insights: risky.slice(0, 3).map((item) => ({
      title: item.client,
      detail: `${item.city} — ${item.notes ?? 'retard probable'}`,
      tone: 'warning' as const,
    })),
    proposedAction: proposeOpen(
      `Voir la livraison — ${head.client}`,
      `/logistics?tab=deliveries&delivery=${head.id}`,
      [
        { key: 'client', label: 'Client', value: head.client },
        { key: 'ville', label: 'Ville', value: head.city },
      ],
    ),
    suggestions: [
      'Propose ordre et flotte pour la tournée.',
      'Quelles tournées sont en cours ?',
      'Qu’est-ce qui nécessite mon attention aujourd’hui ?',
    ],
  })
}

function alertCta(action?: string) {
  if (action === 'replenish' || action === 'da') return 'Créer / ouvrir la DA'
  if (action === 'receive') return 'Ouvrir le BR'
  if (action === 'stock') return 'Voir le stock / lots'
  if (action === 'route' || action === 'delivery') return 'Ouvrir la tournée'
  return action ? `Action : ${action}` : 'Traiter'
}

function proposeOpen(
  summary: string,
  to: string,
  fields: ProposedAction['fields'] = [],
): ProposedAction {
  return {
    type: 'open_screen',
    summary,
    fields: fields.length ? fields : [{ key: 'to', label: 'Écran', value: to }],
    payload: { to },
  }
}

async function openAlerts(user: User): Promise<AssistantReply> {
  let alerts: Awaited<ReturnType<typeof alertService.list>>
  try {
    alerts = await alertService.list(user)
  } catch {
    return msg('Impossible de charger les alertes. Ouvrez le centre d’alertes.', {
      proposedAction: proposeOpen('Centre d’alertes', '/alerts'),
    })
  }
  const severityRank = { critical: 0, warning: 1, info: 2 }
  const actionRank = (action?: string) =>
    action === 'replenish' || action === 'receive' || action === 'da'
      ? 0
      : action === 'stock' || action === 'dispatch' || action === 'route' || action === 'delivery'
        ? 1
        : 2
  const open = alerts
    .filter((item) => !item.read)
    .sort(
      (a, b) =>
        actionRank(a.action) - actionRank(b.action) ||
        severityRank[a.severity] - severityRank[b.severity] ||
        b.createdAt.localeCompare(a.createdAt),
    )
  if (!open.length) {
    return msg('Aucune alerte non lue. La journée est calme de ce côté.', {
      suggestions: ['Qu’est-ce qui nécessite mon attention aujourd’hui ?'],
    })
  }
  const top = open[0]
  const href = alertHref(top, user.role)
  const label = alertActionLabel(top)
  const lines = open.slice(0, 6).map((item) => `• [${item.severity}] ${item.title} — ${item.message} (${alertCta(item.action)})`)
  return msg(`Alertes actionnables (${open.length}) :\n\n${lines.join('\n')}`, {
    insights: open.slice(0, 3).map((item) => ({
      title: item.title,
      detail: `${alertCta(item.action)} · ${item.message}`,
      tone: item.severity,
    })),
    proposedAction: proposeOpen(`${label} — ${top.title}`, href, [
      { key: 'alerte', label: 'Alerte', value: top.title },
      { key: 'action', label: 'Action', value: label },
    ]),
    suggestions: ['Quelles réceptions sont en attente ?', 'Quelles suggestions de réappro ?', 'Lots bientôt périmés ?'],
  })
}

async function replenishSuggestions(user: User): Promise<AssistantReply> {
  const warehouseId = user.warehouseIds[0]
  let rows: Awaited<ReturnType<typeof replenishmentService.list>>
  try {
    rows = await replenishmentService.list(warehouseId)
  } catch {
    return msg(
      'Les suggestions de réappro nécessitent le module Analytics / Stock. Ouvrez Réapprovisionnement.',
      {
        proposedAction: proposeOpen('Réapprovisionnement', '/analytics/forecasts'),
        suggestions: ['Quels produits vont être en rupture ?'],
      },
    )
  }
  const scoped = warehouseId ? rows.filter((row) => row.warehouseId === warehouseId) : rows
  const ranked = [...scoped].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 }
    return rank[a.risk] - rank[b.risk] || b.suggestedQuantity - a.suggestedQuantity
  })
  if (!ranked.length) {
    return msg('Aucune suggestion de réappro calculée. Lancez un recalcul depuis Réapprovisionnement.', {
      suggestions: ['Quels produits vont être en rupture ?', 'Prépare mes approvisionnements.'],
    })
  }
  const [products, warehouses, suppliers] = await Promise.all([
    productService.list(),
    warehouseService.list(),
    supplierService.list().catch(() => []),
  ])
  const top = ranked.slice(0, 5)
  const lines = top.map((row) => {
    const product = products.find((item) => item.id === row.productId)
    const warehouse = warehouses.find((item) => item.id === row.warehouseId)
    const supplier = suppliers.find((item) => item.id === row.supplierId)
    const cost = row.estimatedCost != null ? ` · ~${Math.round(row.estimatedCost)} MAD` : ''
    return `• ${product?.name ?? row.productId} @ ${warehouse?.name ?? row.warehouseId} — ${row.suggestedQuantity} u. (${row.risk})${supplier ? ` · ${supplier.name}` : ''}${cost}`
  })
  const total = Math.round(totalEstimatedCost(top))
  const head = top[0]
  const headProduct = products.find((item) => item.id === head.productId)
  const daTo = `/analytics/forecasts?product=${head.productId}&warehouse=${head.warehouseId}&action=da`
  return msg(
    `Suggestions de réappro (moteur règles) :\n\n${lines.join('\n')}\n\nBudget indicatif top ${top.length} : ~${total} MAD. Confirmez pour ouvrir la DA préremplie sur le cas le plus risqué.`,
    {
      insights: top.slice(0, 3).map((row) => {
        const product = products.find((item) => item.id === row.productId)
        return {
          title: product?.name ?? row.productId,
          detail: `${row.suggestedQuantity} u. · risque ${row.risk}${(row.reasons ?? [])[0] ? ` · ${row.reasons[0]}` : ''}`,
          tone: (row.risk === 'high' ? 'critical' : row.risk === 'medium' ? 'warning' : 'info') as AssistantInsight['tone'],
        }
      }),
      proposedAction: proposeOpen(`Créer la DA — ${headProduct?.name ?? head.productId}`, daTo, [
        { key: 'product', label: 'Produit', value: headProduct?.name ?? head.productId },
        { key: 'qty', label: 'Quantité suggérée', value: String(head.suggestedQuantity) },
        { key: 'risk', label: 'Risque', value: head.risk },
      ]),
      suggestions: ['Prépare mes approvisionnements.', 'Que commander en priorité ?', 'Quels produits vont être en rupture ?'],
    },
  )
}

async function pendingReceipts(): Promise<AssistantReply> {
  let receipts: Awaited<ReturnType<typeof receiptService.list>>
  let delayed: Awaited<ReturnType<typeof purchaseService.delayed>>
  try {
    ;[receipts, delayed] = await Promise.all([receiptService.list(), purchaseService.delayed()])
  } catch {
    return msg(
      'Les bons de réception nécessitent le module Achats. Connectez-vous en acheteur / magasin.',
      {
        proposedAction: proposeOpen('Approvisionnement', '/procurement'),
        suggestions: ['Quelles commandes sont en retard ?'],
      },
    )
  }
  const pending = receipts.filter((item) => ['pending', 'checking', 'partial'].includes(item.status))
  if (!pending.length && !delayed.length) {
    return msg('Aucun BR en attente et aucun OA en retard. Rien à réceptionner en urgence.', {
      suggestions: ['Quelles commandes sont en retard ?'],
    })
  }
  const lines = pending.slice(0, 5).map((item) => `• ${item.code ?? item.id} — ${item.status} (OA ${item.purchaseOrderId})`)
  const delayedLines = delayed
    .slice(0, 3)
    .map((order) => `• OA ${order.code ?? order.id} en retard — ouvrir / créer le BR`)
  const body = [
    pending.length ? `BR à traiter :\n${lines.join('\n')}` : '',
    delayedLines.length ? `OA retard → BR :\n${delayedLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const firstReceipt = pending[0]
  const firstDelayed = delayed[0]
  const open = firstReceipt
    ? proposeOpen(`Ouvrir le BR — ${firstReceipt.code ?? firstReceipt.id}`, `/procurement?tab=receipts&receipt=${firstReceipt.id}`, [
        { key: 'br', label: 'BR', value: firstReceipt.code ?? firstReceipt.id },
        { key: 'oa', label: 'OA', value: firstReceipt.purchaseOrderId },
      ])
    : proposeOpen(
        `Ouvrir le BR — OA ${firstDelayed.code ?? firstDelayed.id}`,
        `/procurement?tab=orders&order=${firstDelayed.id}&action=receive`,
        [
          { key: 'oa', label: 'OA', value: firstDelayed.code ?? firstDelayed.id },
          { key: 'action', label: 'Action', value: 'Créer / ouvrir le BR' },
        ],
      )
  return msg(`${body}\n\nConfirmez pour ouvrir le bon de réception prioritaire.`, {
    insights: pending.slice(0, 3).map((item) => ({
      title: item.code ?? item.id,
      detail: `${item.status} · OA ${item.purchaseOrderId}`,
      tone: 'warning' as const,
    })),
    proposedAction: open,
    suggestions: ['Quelles commandes sont en retard ?', 'Quelles alertes sont ouvertes ?'],
  })
}

async function expiringLots(user: User): Promise<AssistantReply> {
  const warehouseId = user.warehouseIds[0]
  let lots: Awaited<ReturnType<typeof stockLotRepository.list>>
  try {
    lots = await stockLotRepository.list(warehouseId)
  } catch {
    return msg('Impossible de lire les lots. Ouvrez Stock → lots / DLC.', {
      suggestions: ['Quels produits vont être en rupture ?'],
    })
  }
  const horizon = addDays(new Date(`${DEMO_TODAY}T12:00:00`), 14).toISOString().slice(0, 10)
  const soon = lots
    .filter((lot) => lot.expiryDate && lot.quantity > 0 && lot.expiryDate.slice(0, 10) <= horizon)
    .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))
  if (!soon.length) {
    return msg('Aucun lot ne expire dans les 14 jours (fenêtre démo).', {
      suggestions: ['Quels produits vont être en rupture ?', 'Quelles alertes sont ouvertes ?'],
    })
  }
  const [products, warehouses] = await Promise.all([productService.list(), warehouseService.list()])
  const lines = soon.slice(0, 6).map((lot) => {
    const product = products.find((item) => item.id === lot.productId)
    const warehouse = warehouses.find((item) => item.id === lot.warehouseId)
    return `• ${product?.name ?? lot.productId} · lot ${lot.lotCode} @ ${warehouse?.name ?? lot.warehouseId} — DLC ${lot.expiryDate?.slice(0, 10)} · ${lot.quantity} u.`
  })
  const head = soon[0]
  const headProduct = products.find((item) => item.id === head.productId)
  const stockTo = `/stock?article=${head.productId}${head.warehouseId ? `&warehouse=${head.warehouseId}` : ''}`
  return msg(`Lots à surveiller (DLC ≤ 14 j) :\n\n${lines.join('\n')}\n\nConfirmez pour ouvrir la fiche stock du lot le plus proche.`, {
    insights: soon.slice(0, 3).map((lot) => {
      const product = products.find((item) => item.id === lot.productId)
      return {
        title: product?.name ?? lot.lotCode,
        detail: `DLC ${lot.expiryDate?.slice(0, 10)} · ${lot.quantity} u.`,
        tone: 'warning' as const,
      }
    }),
    proposedAction: proposeOpen(`Voir le stock — ${headProduct?.name ?? head.lotCode}`, stockTo, [
      { key: 'lot', label: 'Lot', value: head.lotCode },
      { key: 'dlc', label: 'DLC', value: head.expiryDate?.slice(0, 10) ?? '—' },
    ]),
    suggestions: ['Quelles alertes sont ouvertes ?', 'Quels produits vont être en rupture ?'],
  })
}

async function liveRoutes(user: User): Promise<AssistantReply> {
  let routes: Awaited<ReturnType<typeof logisticsService.routes>>
  try {
    routes = await logisticsService.routes()
  } catch {
    return msg('Les tournées nécessitent le module Logistique.', {
      suggestions: ['Propose ordre et flotte pour la tournée.'],
    })
  }
  const warehouseId = user.warehouseIds[0]
  const live = routes
    .filter((route) => route.status === 'in_progress' || route.status === 'planned')
    .filter((route) => !warehouseId || route.warehouseId === warehouseId || user.role === 'DISPATCHER')
    .sort((a, b) => (a.status === 'in_progress' ? -1 : 1) || a.date.localeCompare(b.date))
  if (!live.length) {
    return msg('Aucune tournée planifiée ou en cours sur votre périmètre.', {
      suggestions: ['Propose ordre et flotte pour la tournée.', 'Quelles livraisons présentent un risque ?'],
    })
  }
  const vehicles = await logisticsService.vehicles().catch(() => [])
  const lines = live.slice(0, 5).map((route) => {
    const vehicle = vehicles.find((item) => item.id === route.vehicleId)
    return `• ${route.name} — ${route.status === 'in_progress' ? 'en cours' : 'planifiée'} · ${Math.round(route.progress)}%${vehicle ? ` · ${vehicle.name}` : ''} · ${route.distanceKm} km`
  })
  const head = live[0]
  return msg(`Tournées actives :\n\n${lines.join('\n')}\n\nConfirmez pour ouvrir le suivi de la tournée prioritaire.`, {
    insights: live.slice(0, 3).map((route) => ({
      title: route.name,
      detail: `${route.status} · ${Math.round(route.progress)}%`,
      tone: (route.status === 'in_progress' ? 'info' : 'warning') as AssistantInsight['tone'],
    })),
    proposedAction: proposeOpen(`Ouvrir la tournée — ${head.name}`, `/logistics?tab=routes&route=${head.id}`, [
      { key: 'route', label: 'Tournée', value: head.name },
      { key: 'status', label: 'Statut', value: head.status === 'in_progress' ? 'en cours' : 'planifiée' },
    ]),
    suggestions: ['Propose ordre et flotte pour la tournée.', 'Quelles livraisons présentent un risque ?'],
  })
}

async function openTasks(user: User): Promise<AssistantReply> {
  let board: Awaited<ReturnType<typeof taskService.board>>
  try {
    board = await taskService.board()
  } catch {
    return msg('Impossible de charger les tâches.', {
      suggestions: ['Qu’est-ce qui nécessite mon attention aujourd’hui ?'],
    })
  }
  const open = (board.tasks ?? []).filter((task) => task.status !== 'done')
  const mine = open.filter((task) => !task.assigneeId || task.assigneeId === user.id)
  const pool = mine.length ? mine : open
  if (!pool.length) {
    return msg('Aucune tâche ouverte. Vous êtes à jour.', {
      suggestions: ['Qu’est-ce qui nécessite mon attention aujourd’hui ?'],
    })
  }
  const lines = pool.slice(0, 6).map((task) => {
    const due = (task.dueAt ?? '').slice(0, 16).replace('T', ' ')
    return `• ${task.title} — ${task.status}${due ? ` · échéance ${due}` : ''}${task.priority === 'high' ? ' · haute' : ''}`
  })
  return msg(`Tâches ouvertes (${pool.length}) :\n\n${lines.join('\n')}`, {
    insights: pool.slice(0, 3).map((task) => ({
      title: task.title,
      detail: `${task.status}${task.dueAt ? ` · ${task.dueAt.slice(0, 10)}` : ''}`,
      tone: (task.priority === 'high' ? 'warning' : 'info') as AssistantInsight['tone'],
    })),
    proposedAction: proposeOpen('Ouvrir les tâches', '/tasks', [
      { key: 'open', label: 'Ouvertes', value: String(pool.length) },
    ]),
    suggestions: ['Quelles alertes sont ouvertes ?', 'Qu’est-ce qui nécessite mon attention aujourd’hui ?'],
  })
}

function extractName(text: string, prefixes: string[]): string {
  let rest = text
  for (const prefix of prefixes) {
    const idx = rest.toLowerCase().indexOf(prefix)
    if (idx >= 0) rest = rest.slice(idx + prefix.length)
  }
  return rest.replace(/[.?!]/g, '').trim()
}

async function proposeSupplier(text: string): Promise<AssistantReply> {
  const name = extractName(text, ['fournisseur', 'supplier']) || 'Nouveau fournisseur'
  const slug = name.toLowerCase().replace(/\s+/g, '')
  const action: ProposedAction = {
    type: 'create_supplier',
    summary: 'Nouveau fournisseur',
    fields: [
      { key: 'name', label: 'Nom', value: name },
      { key: 'email', label: 'Email', value: `contact@${slug || 'fournisseur'}.com` },
      { key: 'phone', label: 'Téléphone', value: '+212 5 00 00 00 00' },
      { key: 'city', label: 'Ville', value: 'Casablanca' },
    ],
    payload: {
      name,
      contact: name,
      email: `contact@${slug || 'fournisseur'}.com`,
      phone: '+212 5 00 00 00 00',
      city: 'Casablanca',
      leadTimeDays: 4,
    },
  }
  return msg('Je peux créer ce fournisseur. Vérifiez les informations puis confirmez.', {
    proposedAction: action,
  })
}

async function proposeProduct(text: string): Promise<AssistantReply> {
  const name = extractName(text, ['produit', 'article']) || 'Nouveau produit'
  const action: ProposedAction = {
    type: 'create_product',
    summary: 'Nouveau produit',
    fields: [
      { key: 'name', label: 'Nom', value: name },
      { key: 'sku', label: 'SKU', value: name.slice(0, 6).toUpperCase().replace(/\s/g, '') },
      { key: 'unit', label: 'Unité', value: 'unité' },
      { key: 'minStock', label: 'Seuil', value: '50' },
    ],
    payload: {
      name,
      sku: name.slice(0, 6).toUpperCase().replace(/\s/g, '') || 'SKU',
      categoryId: 'cat-epicerie',
      unit: 'unité',
      minStock: 50,
      price: 20,
      supplierId: 'sup-abc',
      dailyDemand: 5,
    },
  }
  return msg('Voici la fiche produit. Confirmez pour l’ajouter au catalogue.', { proposedAction: action })
}

async function proposeTask(text: string, user: User): Promise<AssistantReply> {
  const tomorrow = addDays(new Date('2026-08-26T09:00:00'), /demain/i.test(text) ? 1 : 0)
  const hourMatch = text.match(/(\d{1,2})\s*h/)
  const hour = hourMatch ? Number(hourMatch[1]) : 9
  const dueAt = isoAt(tomorrow, hour)
  const title = text
    .replace(/crée?r? (une )?tâche( pour)?/i, '')
    .replace(/demain( à \d{1,2}\s*h)?/i, '')
    .replace(/aujourd['’]hui( à \d{1,2}\s*h)?/i, '')
    .trim() || 'Nouvelle tâche'
  const action: ProposedAction = {
    type: 'create_task',
    summary: 'Nouvelle tâche',
    fields: [
      { key: 'title', label: 'Titre', value: title },
      { key: 'dueAt', label: 'Échéance', value: dueAt },
      { key: 'assignee', label: 'Assignée à', value: `${user.firstName} ${user.lastName}` },
    ],
    payload: { title, dueAt, assigneeId: user.id, priority: 'medium' },
  }
  return msg('Je prépare cette tâche. Confirmez pour l’ajouter à votre journée.', { proposedAction: action })
}

async function proposeProcurement(text: string, user: User): Promise<AssistantReply> {
  const products = await productService.list()
  const found = products.find((item) => text.toLowerCase().includes(item.name.toLowerCase())) ?? products[0]
  const qty = parseQuantity(text) ?? Math.max(120, found.dailyDemand * 6)
  const warehouseId = user.warehouseIds[0] ?? 'wh-casa'
  const warehouses = await warehouseService.list()
  const warehouse = warehouses.find((item) => item.id === warehouseId)
  const action: ProposedAction = {
    type: 'create_procurement',
    summary: 'Demande d’approvisionnement',
    fields: [
      { key: 'product', label: 'Produit', value: found.name },
      { key: 'quantity', label: 'Quantité', value: String(qty) },
      { key: 'warehouse', label: 'Entrepôt', value: warehouse?.name ?? warehouseId },
    ],
    payload: {
      productId: found.id,
      quantity: qty,
      warehouseId,
      note: `Demande préparée par l’assistant — ${found.name}`,
    },
  }
  return msg('Je recommande cette demande. Confirmez pour la créer.', { proposedAction: action })
}

async function proposePurchase(text: string, user: User): Promise<AssistantReply> {
  const products = await productService.list()
  const found = products.find((item) => text.toLowerCase().includes(item.name.toLowerCase())) ?? products[0]
  const qty = parseQuantity(text) ?? Math.max(120, found.dailyDemand * 6)
  const warehouseId = user.warehouseIds[0] ?? 'wh-casa'
  const action: ProposedAction = {
    type: 'create_purchase',
    summary: 'Commande fournisseur',
    fields: [
      { key: 'product', label: 'Produit', value: found.name },
      { key: 'quantity', label: 'Quantité', value: String(qty) },
      { key: 'supplier', label: 'Fournisseur', value: found.supplierId },
    ],
    payload: {
      productId: found.id,
      quantity: qty,
      warehouseId,
      supplierId: found.supplierId,
      amount: found.price * qty,
    },
  }
  return msg('Commande prête à être créée. Confirmez pour l’envoyer en brouillon.', { proposedAction: action })
}

async function execute(action: ProposedAction, user: User): Promise<AssistantReply> {
  if (action.type === 'create_supplier') {
    const created = await supplierService.create({
      name: String(action.payload.name),
      contact: String(action.payload.contact ?? action.payload.name),
      email: String(action.payload.email),
      phone: String(action.payload.phone),
      city: String(action.payload.city),
      leadTimeDays: Number(action.payload.leadTimeDays ?? 4),
    })
    return msg(`Fournisseur créé : ${created.name}.`)
  }
  if (action.type === 'create_product') {
    const created = await productService.create({
      name: String(action.payload.name),
      sku: String(action.payload.sku),
      categoryId: String(action.payload.categoryId),
      unit: String(action.payload.unit),
      minStock: Number(action.payload.minStock),
      price: Number(action.payload.price),
      supplierId: String(action.payload.supplierId),
      dailyDemand: Number(action.payload.dailyDemand),
    })
    return msg(`Produit ajouté : ${created.name}.`)
  }
  if (action.type === 'create_task') {
    const created = await taskService.create({
      title: String(action.payload.title),
      description: 'Créée depuis l’assistant',
      assigneeId: String(action.payload.assigneeId),
      dueAt: String(action.payload.dueAt),
      status: 'todo',
      priority: 'medium',
    })
    return msg(`Tâche créée : ${created.title}. Elle apparaît dans Aujourd’hui.`)
  }
  if (action.type === 'create_procurement') {
    const created = await procurementService.create({
      requesterId: user.id,
      warehouseId: String(action.payload.warehouseId),
      items: [{ productId: String(action.payload.productId), quantity: Number(action.payload.quantity) }],
      note: String(action.payload.note),
    })
    return msg(`Demande créée (${created.id.toUpperCase()}).`)
  }
  if (action.type === 'create_purchase') {
    const expected = addDays(new Date('2026-08-26'), 5).toISOString().slice(0, 10)
    const created = await orders.create({
      supplierId: String(action.payload.supplierId),
      warehouseId: String(action.payload.warehouseId),
      status: 'draft',
      items: [{ productId: String(action.payload.productId), quantity: Number(action.payload.quantity) }],
      expectedDate: expected,
      amount: Number(action.payload.amount),
    })
    return msg(`Commande préparée (${created.id.toUpperCase()}).`)
  }
  if (action.type === 'confirm_delivery') {
    await deliveryService.updateStatus(String(action.payload.deliveryId), 'delivered')
    return msg('Livraison confirmée.')
  }
  if (action.type === 'receive_stock') {
    return msg('Entrée de stock bloquée hors pièce. Ouvrez un bon de réception (BR) pour mettre en stock.')
  }
  if (action.type === 'open_screen') {
    const to = String(action.payload.to ?? '')
    if (!to) return msg('Lien métier manquant.')
    return msg(`Ouverture de l’écran métier : ${action.summary}.`, {
      proposedAction: undefined,
    })
  }
  return msg('Action effectuée.')
}

async function contextualRisks(page: PageContext, user: User): Promise<AssistantReply> {
  if (page === 'stock') return replenishSuggestions(user)
  if (page === 'procurement') return pendingReceipts()
  if (page === 'logistics' || page === 'driver') return liveRoutes(user)
  if (page === 'tasks') return openTasks(user)
  if (page === 'finance') {
    const invoices = (await import('./finance.service')).financeService
    const list = await invoices.invoices()
    const overdue = list.filter((item) => item.status === 'overdue' || item.status === 'pending')
    if (!overdue.length) return msg('Pas d’alerte financière bloquante.')
    return msg(
      overdue.map((item) => `• ${item.id.toUpperCase()} — ${item.status} (${item.amount} MAD)`).join('\n'),
    )
  }
  return attention(user)
}

export const assistantService = {
  detectPage,

  async ask(query: AssistantQuery): Promise<AssistantReply> {
    if (query.confirm) return execute(query.confirm, query.user)
    const text = query.text.trim()
    const lower = text.toLowerCase()

    if (/attention|aujourd|priorit|quoi faire|situation/.test(lower)) return attention(query.user)
    if (/rupture|stock faible|vont être/.test(lower)) return stockouts(query.user)
    if (/retard/i.test(lower) && /commande|fournisseur/.test(lower)) return delayedOrders()
    if (/pourquoi/.test(lower) && /stock/.test(lower)) return whyStockDown(query.user)
    if (
      /fournisseur/.test(lower) &&
      /analys|problème|pose problème|score|scorent|fiabilit|ponctualit/.test(lower)
    ) {
      return analyzeSuppliers()
    }
    if (/qui scorent|meilleur fournisseur|score fournisseur/.test(lower)) return analyzeSuppliers()
    if (
      /(que |quoi )?commander|sourcing|référence interne|offre fournisseur|sans devis/.test(lower) ||
      (/recommand/.test(lower) && /fournisseur|commande|oa|appro/.test(lower))
    ) {
      return recommendSourcing(query.user)
    }
    if (
      /(propos|suggest).*(ordre|flotte|tournée)/.test(lower) ||
      /ordre et flotte|ordre & flotte|assist.*tournée|classement.*(arrêt|tournée)/.test(lower) ||
      (/tournée/.test(lower) && /propos|ordre|flotte|itinéraire/.test(lower))
    ) {
      return assistRouteSummary(query.user)
    }
    if (/livraison/.test(lower) && /risque|retard/.test(lower)) return deliveryRisks(query.user)
    if (/alerte/.test(lower) || (/ouvertes?/.test(lower) && /alerte/.test(lower))) return openAlerts(query.user)
    if (
      /suggestion.*réappro|réappro.*suggest|suggestions? de réappro|quoi réappro|réapprovisionnement/.test(lower) ||
      (/réappro/.test(lower) && /suggest|proposition|moteur|calcul/.test(lower))
    ) {
      return replenishSuggestions(query.user)
    }
    if (
      /réception|bons? de réception|\bbr\b/.test(lower) &&
      /attente|pending|traiter|ouvrir|en cours|à faire/.test(lower)
    ) {
      return pendingReceipts()
    }
    if (/réceptions? (sont |en )?attente|br en attente|bons? de réception/.test(lower)) {
      return pendingReceipts()
    }
    if (/lot/.test(lower) && /périm|dlc|expir|caduc/.test(lower)) return expiringLots(query.user)
    if (/tournée/.test(lower) && /(en )?cours|live|actives?|planifi/.test(lower)) {
      return liveRoutes(query.user)
    }
    if (/quelles? tournées/.test(lower)) return liveRoutes(query.user)
    if (/tâches? (ouvertes?|à faire|en cours)|mes tâches|quelles? tâches/.test(lower)) {
      return openTasks(query.user)
    }
    if (/risque/.test(lower)) return contextualRisks(query.page, query.user)
    if (/prépare/.test(lower) && /appro|demande/.test(lower)) return proposeProcurement(text, query.user)
    if (/prépare/.test(lower) && /commande/.test(lower)) return proposePurchase(text, query.user)
    if (/(ajout|crée|creer).*(fournisseur)/.test(lower)) return proposeSupplier(text)
    if (/(ajout|crée|creer).*(produit)/.test(lower)) return proposeProduct(text)
    if (/(ajout|crée|creer).*(tâche|tache)/.test(lower)) return proposeTask(text, query.user)
    if (/commande/.test(lower) && /retard/.test(lower)) return delayedOrders()
    if (query.page !== 'assistant' && query.page !== 'today' && query.page !== 'other' && text.length < 40) {
      return contextualRisks(query.page, query.user)
    }
    return attention(query.user)
  },

  toMessage(reply: AssistantReply): AssistantMessage {
    return {
      id: uid('msg'),
      role: 'assistant',
      content: reply.content,
      createdAt: new Date().toISOString(),
      suggestions: reply.suggestions,
      proposedAction: reply.proposedAction,
      insights: reply.insights,
    }
  },
}
