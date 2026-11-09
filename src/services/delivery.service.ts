import { deliveryRepository } from '@/repositories'
import type { DeliveryInput } from '@/repositories/interfaces'
import type { Delivery } from '@/types'

export const deliveryService = {
  list: () => deliveryRepository.list(),
  create: (input: DeliveryInput) => deliveryRepository.create(input),
  update: (id: string, input: Partial<DeliveryInput>) => deliveryRepository.update(id, input),
  updateStatus: (id: string, status: Delivery['status'], note?: string, signedBy?: string) =>
    deliveryRepository.updateStatus(id, status, note, signedBy),
  atRisk: async () => {
    const list = await deliveryRepository.list()
    return list.filter((item) => item.status === 'at_risk' || item.status === 'failed')
  },
  forDriver: async (driverId: string) => {
    const list = await deliveryRepository.list()
    return list
      .filter((item) => item.driverId === driverId)
      .sort((a, b) => a.sequence - b.sequence || a.scheduledAt.localeCompare(b.scheduledAt))
  },
}
