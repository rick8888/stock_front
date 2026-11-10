import type { AnalyticsRepository } from '@/repositories/interfaces'
import { db, withLatency } from './db'
import { opsToday } from '@/utils/helpers'

export class MockAnalyticsRepository implements AnalyticsRepository {
  snapshot() {
    return withLatency(() => {
      const today = opsToday()
      const deliveries = db().deliveries
      const delivered = deliveries.filter((item) => item.status === 'delivered')
      const onTime = delivered.filter((item) => {
        const scheduled = item.scheduledAt.slice(0, 10)
        const signed = (item.signedAt ?? item.scheduledAt).slice(0, 10)
        return signed <= scheduled
      }).length
      const products = new Map(db().products.map((item) => [item.id, item]))
      let stockouts = 0
      let stockWatch = 0
      db().stock.forEach((row) => {
        const product = products.get(row.productId)
        if (!product || product.archived) return
        const available = Math.max(0, row.quantity - (row.reserved || 0))
        if (available <= 0) stockouts += 1
        else if (available < product.minStock) stockWatch += 1
      })
      const delayedOrders = db().purchaseOrders.filter((order) => {
        if (['received', 'cancelled'].includes(order.status)) return false
        return (order.expectedDate ?? '') < today
      }).length
      const deliveryCostMad = Math.round(db().routes.reduce((sum, route) => sum + route.distanceKm * 2.4, 0))
      const issued = db().stockMovements.filter((item) => item.type === 'issue').reduce((sum, item) => sum + item.quantity, 0)
      const received = db().stockMovements
        .filter((item) => item.type === 'receive')
        .reduce((sum, item) => sum + item.quantity, 0)
      return {
        otifRate: delivered.length ? Math.round((onTime / delivered.length) * 1000) / 10 : 100,
        otifDelivered: delivered.length,
        otifOnTime: onTime,
        stockouts,
        stockWatch,
        delayedOrders,
        failedDeliveries: deliveries.filter((item) => item.status === 'failed').length,
        deliveryCostMad,
        costPerDelivery: delivered.length ? Math.round(deliveryCostMad / delivered.length) : 0,
        issued,
        received,
        netFlow: received - issued,
        windowDays: 30,
      }
    })
  }
}
