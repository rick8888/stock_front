import type { StockMovementType } from '@/types'

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  receive: 'Réception',
  issue: 'Sortie',
  transfer: 'Transfert',
  adjust: 'Ajustement',
  return: 'Retour',
}
