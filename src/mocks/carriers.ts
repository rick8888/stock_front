import type { Carrier } from '@/types'

/** Catalogue stub Maroc — pas d’API transporteur réelle. */
export const carriers: Carrier[] = [
  {
    id: 'car-fleet',
    name: 'Flotte interne',
    code: 'FLEET',
    kind: 'own_fleet',
    active: true,
  },
  {
    id: 'car-ctm',
    name: 'CTM Messagerie',
    code: 'CTM',
    kind: 'freight',
    trackingUrlTemplate: 'https://www.ctm.ma/suivi?ref={tracking}',
    active: true,
  },
  {
    id: 'car-amana',
    name: 'Amana (Barid)',
    code: 'AMANA',
    kind: 'parcel',
    trackingUrlTemplate: 'https://www.amap.ma/suivi/{tracking}',
    active: true,
  },
  {
    id: 'car-chrono',
    name: 'Chronopost Maroc',
    code: 'CHRONO',
    kind: 'parcel',
    trackingUrlTemplate: 'https://www.chronopost.ma/tracking/{tracking}',
    active: true,
  },
]
