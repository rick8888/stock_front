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
  stock: {
    id: 'stock',
    prompt: 'Quels produits vont être en rupture ?',
    label: 'Risques de rupture',
    detail: 'Le stock qui ne tiendra pas.',
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
  suppliers: {
    id: 'suppliers',
    prompt: 'Analyse mes fournisseurs.',
    label: 'Fournisseurs',
    detail: 'Fiabilité et retards.',
  },
}

export function assistantStarters(role?: RoleKey): AssistantStarter[] {
  if (role === 'FINANCE') return [starters.attention, starters.orders]
  if (role === 'DISPATCHER' || role === 'DRIVER') return [starters.attention, starters.delivery]
  if (role === 'WAREHOUSE_MANAGER') return [starters.attention, starters.stock]
  if (role === 'PROCUREMENT') return [starters.attention, starters.stock, starters.orders, starters.suppliers]
  return [starters.attention, starters.stock, starters.delivery]
}

export function assistantPlaceholder(role?: RoleKey) {
  if (role === 'WAREHOUSE_MANAGER') return 'Une réception, un risque de stock…'
  if (role === 'PROCUREMENT') return 'Une rupture, un retard fournisseur…'
  if (role === 'FINANCE') return 'Une facture, un budget…'
  if (role === 'DISPATCHER' || role === 'DRIVER') return 'Une tournée, un retard…'
  return 'Demandez ce qui se passe, ou ce qu’il faut faire…'
}

export function assistantPageDescription(role?: RoleKey) {
  if (role === 'WAREHOUSE_MANAGER') return 'Stock, réceptions, sorties — je m’appuie sur vos entrepôts.'
  if (role === 'PROCUREMENT') return 'Ruptures, devis, commandes — je prépare l’action ensuite.'
  if (role === 'FINANCE') return 'Échéances et engagements, sans le bruit opérationnel.'
  if (role === 'DISPATCHER') return 'Tournées et incidents, pour débloquer un créneau.'
  if (role === 'DRIVER') return 'Votre tournée du jour, en une question.'
  return 'Posez une question. Je m’appuie sur votre activité réelle.'
}
