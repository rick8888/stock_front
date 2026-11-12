import { logisticsRepository } from '@/repositories'
import type { DriverInput, RouteInput, ShipmentInput, ShippingNoteInput, VehicleInput } from '@/repositories/interfaces'

export const logisticsService = {
  board: (query?: import('@/repositories/interfaces').LogisticsBoardQuery) => logisticsRepository.board(query),
  shipments: () => logisticsRepository.shipments(),
  routes: () => logisticsRepository.routes(),
  vehicles: () => logisticsRepository.vehicles(),
  drivers: () => logisticsRepository.drivers(),
  shippingNotes: () => logisticsRepository.shippingNotes(),
  carriers: () => logisticsRepository.carriers(),
  createVehicle: (input: VehicleInput) => logisticsRepository.createVehicle(input),
  updateVehicle: (id: string, input: Partial<VehicleInput>) => logisticsRepository.updateVehicle(id, input),
  createDriver: (input: DriverInput) => logisticsRepository.createDriver(input),
  updateDriver: (id: string, input: Partial<DriverInput>) => logisticsRepository.updateDriver(id, input),
  createRoute: (input: RouteInput) => logisticsRepository.createRoute(input),
  updateRoute: (id: string, input: Partial<RouteInput>) => logisticsRepository.updateRoute(id, input),
  assistRoute: (input: import('@/repositories/interfaces').RouteAssistInput) => logisticsRepository.assistRoute(input),
  createShipment: (input: ShipmentInput) => logisticsRepository.createShipment(input),
  updateShipment: (id: string, input: Partial<ShipmentInput>) => logisticsRepository.updateShipment(id, input),
  createShippingNote: (input: ShippingNoteInput) => logisticsRepository.createShippingNote(input),
  updateShippingNote: (id: string, input: Partial<ShippingNoteInput>) => logisticsRepository.updateShippingNote(id, input),
  assignCarrier: (id: string, input: import('@/repositories/interfaces').ShippingNoteCarrierInput) =>
    logisticsRepository.assignCarrier(id, input),
  markLabelPrinted: (id: string) => logisticsRepository.markLabelPrinted(id),
  startPicking: (id: string) => logisticsRepository.startPicking(id),
  loadShippingNote: (id: string, userId: string) => logisticsRepository.loadShippingNote(id, userId),
}
