import { warehouseRepository } from '@/repositories'

export const warehouseService = {
  list: () => warehouseRepository.list(),
  getById: (id: string) => warehouseRepository.getById(id),
  create: warehouseRepository.create.bind(warehouseRepository),
  update: warehouseRepository.update.bind(warehouseRepository),
}
