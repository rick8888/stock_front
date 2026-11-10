import type { SupplierProduct } from '@/types'
import type { SupplierProductRepository } from '@/repositories/interfaces'
import { withLatency } from './db'

/**
 * Le jeu de démonstration hors ligne ne porte pas de conditions d'achat :
 * sans catalogue, ni minimum de commande ni colisage ne sont appliqués.
 */
export class MockSupplierProductRepository implements SupplierProductRepository {
  list() {
    return withLatency((): SupplierProduct[] => [])
  }
}
