import type { AppNotification, AssistantMessage, InventorySession, RoleKey, User } from '@/types'

export const inventories: InventorySession[] = [
  {
    id: 'inv-01',
    warehouseId: 'wh-casa',
    status: 'pending_review',
    counted: 58,
    expected: 64,
    startedAt: '2026-08-26T09:00:00.000Z',
    userId: 'usr-warehouse',
    countedByUserId: 'usr-warehouse',
    lines: [{ productId: 'prd-farine', expected: 64, counted: 58 }],
  },
]

export const notifications: AppNotification[] = [
  {
    id: 'ntf-01',
    title: 'Risque de rupture',
    message: 'Huile végétale 5L — Casablanca, couverture 3 jours.',
    createdAt: '2026-08-26T06:40:00.000Z',
    read: false,
    type: 'critical',
  },
  {
    id: 'ntf-02',
    title: 'Livraison retardée',
    message: 'Livraison #482 — Supermarché Atlas.',
    createdAt: '2026-08-26T08:50:00.000Z',
    read: false,
    type: 'warning',
  },
  {
    id: 'ntf-03',
    title: 'Réception validée',
    message: 'Lait UHT — 400 unités à Casablanca.',
    createdAt: '2026-08-23T14:05:00.000Z',
    read: true,
    type: 'info',
  },
  {
    id: 'ntf-04',
    title: 'Nouvelle tâche',
    message: 'Valider 3 demandes d’approvisionnement.',
    createdAt: '2026-08-26T07:20:00.000Z',
    read: true,
    type: 'info',
  },
  {
    id: 'ntf-05',
    title: 'Bon de livraison prêt',
    message: 'BL-2026-00901 · Pharmacie des Habous (Casablanca)',
    createdAt: '2026-08-26T08:10:00.000Z',
    read: false,
    type: 'info',
    userId: 'usr-dispatcher',
  },
]

export function welcomeFor(user?: User | null): Omit<AssistantMessage, 'id' | 'createdAt'> {
  const greet = user?.firstName ? `Bonjour ${user.firstName}.` : 'Bonjour.'
  return {
    role: 'assistant',
    content: `${greet} Je peux vous dire ce qui mérite votre attention, préparer une action, ou répondre à une question sur votre activité.`,
    suggestions: suggestionsFor(user?.role),
  }
}

function suggestionsFor(role?: RoleKey): string[] {
  if (role === 'FINANCE') {
    return [
      'Qu’est-ce qui nécessite mon attention aujourd’hui ?',
      'Quelles commandes sont en retard ?',
    ]
  }
  if (role === 'DISPATCHER' || role === 'DRIVER') {
    return [
      'Qu’est-ce qui nécessite mon attention aujourd’hui ?',
      'Quelles livraisons présentent un risque ?',
    ]
  }
  if (role === 'WAREHOUSE_MANAGER') {
    return [
      'Qu’est-ce qui nécessite mon attention aujourd’hui ?',
      'Quels produits vont être en rupture ?',
    ]
  }
  if (role === 'PROCUREMENT') {
    return [
      'Quels produits vont être en rupture ?',
      'Quelles commandes sont en retard ?',
      'Analyse mes fournisseurs.',
    ]
  }
  return [
    'Qu’est-ce qui nécessite mon attention aujourd’hui ?',
    'Quels produits vont être en rupture ?',
    'Quelles livraisons présentent un risque ?',
  ]
}

export const assistantWelcome = welcomeFor()
