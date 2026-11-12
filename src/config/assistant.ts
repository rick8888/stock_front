import type { RoleKey } from '@/types'

export interface AssistantStarter {
  id: string
  prompt: string
  label: string
  detail: string
}

const starters: Record<string, AssistantStarter> = {
  attention: {
    id: 'attention',
    prompt: 'Qu’est-ce qui nécessite mon attention aujourd’hui ?',
    label: 'Priorités du jour',
    detail: 'Ce qui peut encore changer la journée.',
  },
  alerts: {
    id: 'alerts',
    prompt: 'Quelles alertes sont ouvertes ?',
    label: 'Alertes ouvertes',
    detail: 'CTA métier non lus.',
  },
  stock: {
    id: 'stock',
    prompt: 'Quels produits vont être en rupture ?',
    label: 'Risques de rupture',
    detail: 'Le stock qui ne tiendra pas.',
  },
  replenish: {
    id: 'replenish',
    prompt: 'Quelles suggestions de réappro ?',
    label: 'Suggestions réappro',
    detail: 'Moteur règles · quantité & risque.',
  },
  receipts: {
    id: 'receipts',
    prompt: 'Quelles réceptions sont en attente ?',
    label: 'BR en attente',
    detail: 'Réceptions et OA en retard.',
  },
  lots: {
    id: 'lots',
    prompt: 'Lots bientôt périmés ?',
    label: 'DLC proches',
    detail: 'Lots à échéance ≤ 14 j.',
  },
  orders: {
    id: 'orders',
    prompt: 'Quelles commandes sont en retard ?',
    label: 'Commandes en retard',
    detail: 'Fournisseurs qui décalent.',
  },
  delivery: {
    id: 'delivery',
    prompt: 'Quelles livraisons présentent un risque ?',
    label: 'Livraisons à risque',
    detail: 'Tournées sous tension.',
  },
  routesLive: {
    id: 'routesLive',
    prompt: 'Quelles tournées sont en cours ?',
    label: 'Tournées live',
    detail: 'Planifiées et en cours.',
  },
  tasks: {
    id: 'tasks',
    prompt: 'Quelles tâches sont ouvertes ?',
    label: 'Tâches ouvertes',
    detail: 'Kanban ops à traiter.',
  },
  suppliers: {
    id: 'suppliers',
    prompt: 'Qui scorent le mieux ?',
    label: 'Score fournisseurs',
    detail: 'Fiabilité dynamique + ponctualité OA.',
  },
  sourcing: {
    id: 'sourcing',
    prompt: 'Que commander en priorité ?',
    label: 'Reco sourcing',
    detail: 'Référence interne sans devis.',
  },
  routeAssist: {
    id: 'routeAssist',
    prompt: 'Propose ordre et flotte pour la tournée.',
    label: 'Ordre & flotte',
    detail: 'Classement arrêts + chauffeur / véhicule.',
  },
}

export function assistantStarters(role?: RoleKey): AssistantStarter[] {
  if (role === 'FINANCE') return [starters.attention, starters.alerts, starters.orders]
  if (role === 'DISPATCHER') {
    return [starters.attention, starters.alerts, starters.delivery, starters.routesLive, starters.routeAssist]
  }
  if (role === 'DRIVER') return [starters.attention, starters.delivery, starters.routesLive]
  if (role === 'WAREHOUSE_MANAGER') {
    return [starters.attention, starters.alerts, starters.receipts, starters.lots, starters.stock, starters.replenish]
  }
  if (role === 'PROCUREMENT') {
    return [
      starters.attention,
      starters.alerts,
      starters.stock,
      starters.replenish,
      starters.orders,
      starters.receipts,
      starters.suppliers,
      starters.sourcing,
    ]
  }
  return [
    starters.attention,
    starters.alerts,
    starters.stock,
    starters.replenish,
    starters.tasks,
    starters.delivery,
    starters.routeAssist,
  ]
}

export function assistantPlaceholder(role?: RoleKey) {
  if (role === 'WAREHOUSE_MANAGER') return 'Une réception, une DLC, un risque de stock…'
  if (role === 'PROCUREMENT') return 'Une rupture, une réappro, un score fournisseur…'
  if (role === 'FINANCE') return 'Une facture, un budget, une alerte…'
  if (role === 'DISPATCHER') return 'Une tournée live, un ordre & flotte…'
  if (role === 'DRIVER') return 'Une tournée, un retard…'
  return 'Alertes, réappro, BR, tournées, tâches…'
}

export function assistantPageDescription(role?: RoleKey) {
  const disclaimer = 'Règles ops sur vos données — pas un copilote IA génératif.'
  if (role === 'WAREHOUSE_MANAGER') return `Stock, BR, DLC, réappro. ${disclaimer}`
  if (role === 'PROCUREMENT') return `Ruptures, réappro, devis, commandes. ${disclaimer}`
  if (role === 'FINANCE') return `Échéances et engagements. ${disclaimer}`
  if (role === 'DISPATCHER') return `Tournées live et incidents. ${disclaimer}`
  if (role === 'DRIVER') return `Votre tournée du jour. ${disclaimer}`
  return `Posez une question sur l’activité. ${disclaimer}`
}
