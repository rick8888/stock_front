import type { PlanningEvent } from '@/types'

export const planning: PlanningEvent[] = [
  {
    id: 'pl-01',
    title: 'Réception ABC Supply',
    date: '2026-08-26T08:30:00',
    type: 'receipt',
    relatedId: 'rcp-13',
  },
  {
    id: 'pl-02',
    title: 'Tournée Casa centre',
    date: '2026-08-26T09:00:00',
    type: 'delivery',
    relatedId: 'rt-26a',
  },
  {
    id: 'pl-03',
    title: 'Point fournisseurs',
    date: '2026-08-26T11:00:00',
    type: 'meeting',
    relatedId: 'po-1042',
  },
  {
    id: 'pl-04',
    title: 'Retour véhicules',
    date: '2026-08-26T16:30:00',
    type: 'delivery',
    relatedId: 'rt-26a',
  },
  {
    id: 'pl-05',
    title: 'Inventaire farine Casa',
    date: '2026-08-26T17:00:00',
    type: 'inventory',
    relatedId: 'inv-01',
  },
  {
    id: 'pl-06',
    title: 'Tournée Rabat nord',
    date: '2026-08-27T09:00:00',
    type: 'delivery',
    relatedId: 'rt-27b',
  },
  {
    id: 'pl-07',
    title: 'Réception riz Casa',
    date: '2026-08-28T10:00:00',
    type: 'receipt',
    relatedId: 'rcp-13',
  },
  {
    id: 'pl-08',
    title: 'Réception lait Rabat',
    date: '2026-08-29T09:30:00',
    type: 'receipt',
    relatedId: 'rcp-14',
  },
  {
    id: 'pl-09',
    title: 'Point ruptures de la semaine',
    date: '2026-08-28T15:00:00',
    type: 'meeting',
    relatedId: 'prd-lait',
  },
]
