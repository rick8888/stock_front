import type { InventoryLine, InventorySession, StockMovement, StockMovementType } from '@/types'
import type { StockOverviewBoard, StockRepository } from '@/repositories/interfaces'
import { assertInboundDocument, assertOutboundDocument, assertInventoryAdjust } from '@/utils/stockDocuments'
import { consumePlacementPath } from '@/utils/placements'
import {
  filterStockForInventory,
  inventoryModeFromScope,
  normalizeInventoryScope,
} from '@/utils/inventoryScope'
import { buildStockOverviewBoard } from '@/services/stock.overview'
import { uid, opsToday } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'
import { useAuthStore } from '@/stores/auth'

function line(productId: string, warehouseId: string) {
  const item = db().stock.find((row) => row.productId === productId && row.warehouseId === warehouseId)
  if (!item) throw new Error('Ligne de stock introuvable')
  return item
}

function movement(
  type: StockMovementType,
  productId: string,
  quantity: number,
  userId: string,
  note: string,
  fromWarehouseId?: string,
  toWarehouseId?: string,
  reference?: string,
): StockMovement {
  const row: StockMovement = {
    id: uid('mov'),
    productId,
    type,
    quantity,
    fromWarehouseId,
    toWarehouseId,
    userId,
    date: new Date().toISOString(),
    note,
    reference,
  }
  db().stockMovements.unshift(row)
  return row
}

function audit(action: string, entity: string, entityId: string, userId: string) {
  db().auditLogs.unshift({
    id: uid('aud'),
    userId,
    action,
    entity,
    entityId,
    createdAt: new Date().toISOString(),
  })
}

function tally(lines: InventoryLine[]) {
  return {
    expected: lines.reduce((sum, item) => sum + item.expected, 0),
    counted: lines.reduce((sum, item) => sum + item.counted, 0),
  }
}

export class MockStockRepository implements StockRepository {
  list() {
    return withLatency(() => db().stock)
  }

  overview(): Promise<StockOverviewBoard> {
    return withLatency(() => {
      const user = useAuthStore().currentUser
      const warehouseIds = user?.warehouseIds?.length ? user.warehouseIds : undefined
      return buildStockOverviewBoard(db(), warehouseIds)
    })
  }

  movements() {
    return withLatency(() => db().stockMovements)
  }

  inventories() {
    return withLatency(() => db().inventories)
  }

  receive(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string) {
    return mutate(() => {
      if (quantity <= 0) throw new Error('Quantité invalide')
      const piece = assertInboundDocument(reference, note)
      line(productId, warehouseId).quantity += quantity
      movement('receive', productId, quantity, userId, note, undefined, warehouseId, piece)
      audit('Réception stock', 'stock', productId, userId)
    })
  }

  issue(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string) {
    return mutate(() => {
      if (quantity <= 0) throw new Error('Quantité invalide')
      const piece = assertOutboundDocument(reference, note)
      const item = line(productId, warehouseId)
      if (item.quantity < quantity) throw new Error('Stock insuffisant')
      item.quantity -= quantity
      consumePlacementPath(productId, warehouseId, quantity)
      movement('issue', productId, quantity, userId, note, warehouseId, undefined, piece)
      audit('Sortie de stock', 'stock', productId, userId)
    })
  }

  transfer(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    userId: string,
    note = 'Transfert',
  ) {
    return mutate(() => {
      if (fromWarehouseId === toWarehouseId) throw new Error('Choisissez un autre entrepôt.')
      if (quantity <= 0) throw new Error('Quantité invalide')
      const from = line(productId, fromWarehouseId)
      if (from.quantity < quantity) throw new Error('Stock insuffisant')
      from.quantity -= quantity
      line(productId, toWarehouseId).quantity += quantity
      movement('transfer', productId, quantity, userId, note, fromWarehouseId, toWarehouseId)
      audit('Transfert de stock', 'stock', productId, userId)
    })
  }

  adjust(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string) {
    return mutate(() => {
      if (!quantity) throw new Error('Écart nul')
      const piece = assertInventoryAdjust(reference, note)
      const item = line(productId, warehouseId)
      const next = item.quantity + quantity
      if (next < 0) throw new Error('Stock insuffisant')
      item.quantity = next
      movement('adjust', productId, quantity, userId, note, warehouseId, undefined, piece)
      audit('Ajustement de stock', 'stock', productId, userId)
    })
  }

  returnStock(productId: string, warehouseId: string, quantity: number, userId: string, note: string, reference?: string) {
    return mutate(() => {
      if (quantity <= 0) throw new Error('Quantité invalide')
      line(productId, warehouseId).quantity += quantity
      movement('return', productId, quantity, userId, note, undefined, warehouseId, reference)
      audit('Retour en stock', 'stock', productId, userId)
    })
  }

  toggleAssignment(productId: string, warehouseId: string, enabled: boolean) {
    return mutate(() => {
      const existing = db().stock.find((row) => row.productId === productId && row.warehouseId === warehouseId)
      if (!existing) {
        db().stock.push({
          id: uid('stk'),
          productId,
          warehouseId,
          quantity: 0,
          reserved: 0,
          enabled,
        })
        return
      }
      existing.enabled = enabled
    })
  }

  startInventory(warehouseId: string, userId: string, scope?: import('@/types').InventoryScope) {
    return mutate(() => {
      const open = db().inventories.find(
        (item) => item.warehouseId === warehouseId && item.status !== 'completed',
      )
      if (open) {
        if (!open.lines) open.lines = []
        return open
      }
      const normalized = normalizeInventoryScope(scope)
      const rows = filterStockForInventory({
        warehouseId,
        stock: db().stock,
        products: db().products,
        placements: db().stockPlacements,
        locations: db().warehouseLocations,
        scope: normalized,
      })
      const lines: InventoryLine[] = rows.map((row) => ({
        productId: row.productId,
        expected: row.quantity,
        counted: row.quantity,
      }))
      if (!lines.length) {
        throw new Error(
          normalized
            ? 'Aucun article dans ce périmètre de cycle count.'
            : 'Aucun article actif sur cet entrepôt.',
        )
      }
      const sums = tally(lines)
      const session: InventorySession = {
        id: uid('inv'),
        warehouseId,
        status: 'in_progress',
        mode: inventoryModeFromScope(normalized),
        scope: normalized,
        startedAt: new Date().toISOString(),
        userId,
        lines,
        ...sums,
      }
      db().inventories.unshift(session)
      audit(
        session.mode === 'partial' ? 'Cycle count démarré' : 'Inventaire démarré',
        'inventory',
        session.id,
        userId,
      )
      return session
    })
  }

  saveInventory(id: string, lines: { productId: string; counted: number }[]) {
    return mutate(() => {
      const session = db().inventories.find((item) => item.id === id)
      if (!session) throw new Error('Inventaire introuvable')
      if (session.status !== 'in_progress') throw new Error('Ce comptage n’est plus modifiable')
      session.lines = (session.lines ?? []).map((line) => {
        const next = lines.find((item) => item.productId === line.productId)
        return next ? { ...line, counted: Math.max(0, next.counted) } : line
      })
      Object.assign(session, tally(session.lines))
      return session
    })
  }

  submitInventory(id: string, userId: string) {
    return mutate(() => {
      const session = db().inventories.find((item) => item.id === id)
      if (!session) throw new Error('Inventaire introuvable')
      if (session.status !== 'in_progress') throw new Error('Inventaire déjà soumis ou clôturé')
      const gaps = (session.lines ?? []).filter((line) => line.counted !== line.expected)
      if (!gaps.length) throw new Error('Aucun écart : clôturez directement.')
      session.status = 'pending_review'
      session.countedByUserId = userId
      session.userId = userId
      audit('Écarts d’inventaire soumis', 'inventory', session.id, userId)
      return session
    })
  }

  completeInventory(id: string, userId: string) {
    return mutate(() => {
      const session = db().inventories.find((item) => item.id === id)
      if (!session) throw new Error('Inventaire introuvable')
      if (session.status === 'completed') throw new Error('Inventaire déjà clôturé')
      const actor = db().users.find((item) => item.id === userId)
      const gaps = (session.lines ?? []).filter((line) => line.counted !== line.expected)
      const canApprove = actor?.role === 'ADMIN' || actor?.role === 'MANAGER' || actor?.role === 'SUPER_ADMIN'
      if (session.status === 'in_progress' && gaps.length) {
        throw new Error('Les écarts doivent d’abord être soumis pour validation.')
      }
      if (session.status === 'pending_review' && !canApprove) {
        throw new Error('Un manager ou un administrateur doit valider les écarts.')
      }
      for (const row of session.lines ?? []) {
        const delta = row.counted - row.expected
        if (!delta) continue
        const item = line(row.productId, session.warehouseId)
        const next = item.quantity + delta
        if (next < 0) throw new Error('Stock insuffisant')
        item.quantity = next
        movement(
          'adjust',
          row.productId,
          delta,
          userId,
          `${session.mode === 'partial' ? 'Cycle count' : 'Inventaire'} ${session.id}`,
          session.warehouseId,
          undefined,
          `PV-${session.id.replace(/^inv-/, '').toUpperCase()}`,
        )
      }
      session.status = 'completed'
      session.completedAt = new Date().toISOString()
      session.userId = userId
      if (gaps.length) session.approvedByUserId = userId
      else session.countedByUserId = session.countedByUserId ?? userId
      Object.assign(session, tally(session.lines ?? []))
      audit('Inventaire clôturé', 'inventory', session.id, userId)
      return session
    })
  }

  closeDay(warehouseId: string, userId: string) {
    return mutate(() => {
      const stamp = `${warehouseId}|${opsToday()}`
      const already = db().auditLogs.some(
        (item) => item.action === 'Clôture de journée' && item.entityId === stamp,
      )
      if (already) throw new Error('Cette journée est déjà clôturée.')
      audit('Clôture de journée', 'warehouse', stamp, userId)
    })
  }
}
