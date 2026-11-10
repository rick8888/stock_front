import type { ShippingNote } from '@/types'
import { db } from '@/repositories/mock/db'

export function reserveNoteStock(note: ShippingNote) {
  if (note.stockReserved || note.loadedAt) return
  for (const line of note.lines) {
    const stock = db().stock.find((row) => row.productId === line.productId && row.warehouseId === note.warehouseId)
    if (!stock) throw new Error(`Stock introuvable pour ${line.productName}`)
    const available = stock.quantity - (stock.reserved || 0)
    if (available < line.quantity) throw new Error(`Stock disponible insuffisant pour ${line.productName}`)
    stock.reserved = (stock.reserved || 0) + line.quantity
  }
  note.stockReserved = true
}

export function releaseNoteStock(note: ShippingNote) {
  if (!note.stockReserved || note.loadedAt) return
  for (const line of note.lines) {
    const stock = db().stock.find((row) => row.productId === line.productId && row.warehouseId === note.warehouseId)
    if (!stock) continue
    stock.reserved = Math.max(0, (stock.reserved || 0) - line.quantity)
  }
  note.stockReserved = false
}

export function consumeNoteReservation(note: ShippingNote) {
  if (!note.stockReserved) reserveNoteStock(note)
  for (const line of note.lines) {
    const stock = db().stock.find((row) => row.productId === line.productId && row.warehouseId === note.warehouseId)
    if (!stock || stock.quantity < line.quantity) {
      throw new Error(`Stock insuffisant pour ${line.productName}`)
    }
    stock.reserved = Math.max(0, (stock.reserved || 0) - line.quantity)
    stock.quantity -= line.quantity
  }
  note.stockReserved = false
}
