import type { AssistantInsight, AssistantMessage, ProposedAction, User } from '@/types'
import { uid, addDays, isoAt, parseQuantity } from '@/utils/helpers'
import { todayService } from './today.service'
import { stockService } from './stock.service'
import { purchaseService } from './purchase.service'
import { deliveryService } from './delivery.service'
import { supplierService } from './supplier.service'
import { productService } from './product.service'
import { procurementService } from './procurement.service'
import { purchaseService as orders } from './purchase.service'
import { taskService } from './task.service'
import { warehouseService } from './warehouse.service'
import { stockRepository } from '@/repositories'

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
    suggestions: ['Prépare mes approvisionnements.', 'Quels produits vont être en rupture ?'],
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
    suggestions: ['Prépare une commande.', 'Pourquoi mon stock baisse ?'],
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
    suggestions: ['Analyse mes fournisseurs.'],
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
  const suppliers = await supplierService.list()
  const delayed = await purchaseService.delayed()
  const worst = [...suppliers].sort((a, b) => a.reliability - b.reliability)[0]
  const delayedName = delayed
    .map((order) => suppliers.find((item) => item.id === order.supplierId)?.name)
    .filter(Boolean)
  const lines = suppliers
    .sort((a, b) => a.reliability - b.reliability)
    .map((item) => `• ${item.name} — fiabilité ${item.reliability}%, délai ${item.leadTimeDays} j`)
  return msg(
    `${worst.name} est le plus fragile (${worst.reliability}%). ${
      delayedName.length ? `Retards en cours : ${delayedName.join(', ')}.` : ''
    }\n\n${lines.join('\n')}`,
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
  return msg(`Livraisons à risque :\n\n${lines.join('\n')}`, {
    insights: risky.slice(0, 3).map((item) => ({
      title: item.client,
      detail: `${item.city} — ${item.notes ?? 'retard probable'}`,
      tone: 'warning' as const,
    })),
    suggestions: ['Qu’est-ce qui nécessite mon attention aujourd’hui ?'],
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
  return msg('Action effectuée.')
}

async function contextualRisks(page: PageContext, user: User): Promise<AssistantReply> {
  if (page === 'stock') return stockouts(user)
  if (page === 'procurement') return analyzeSuppliers()
  if (page === 'logistics' || page === 'driver') return deliveryRisks(user)
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
    if (/fournisseur/.test(lower) && /analys|problème|pose problème/.test(lower)) return analyzeSuppliers()
    if (/livraison/.test(lower) && /risque|retard/.test(lower)) return deliveryRisks(query.user)
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
