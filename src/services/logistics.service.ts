import { logisticsRepository } from '@/repositories'
import type { DriverInput, RouteInput, ShipmentInput, ShippingNoteInput, VehicleInput } from '@/repositories/interfaces'

export const logisticsService = {
  shipments: () => logisticsRepository.shipments(),
  routes: () => logisticsRepository.routes(),
  vehicles: () => logisticsRepository.vehicles(),
  drivers: () => logisticsRepository.drivers(),
  shippingNotes: () => logisticsRepository.shippingNotes(),
  createVehicle: (input: VehicleInput) => logisticsRepository.createVehicle(input),
  updateVehicle: (id: string, input: Partial<VehicleInput>) => logisticsRepository.updateVehicle(id, input),
  createDriver: (input: DriverInput) => logisticsRepository.createDriver(input),
  updateDriver: (id: string, input: Partial<DriverInput>) => logisticsRepository.updateDriver(id, input),
  createRoute: (input: RouteInput) => logisticsRepository.createRoute(input),
  updateRoute: (id: string, input: Partial<RouteInput>) => logisticsRepository.updateRoute(id, input),
  createShipment: (input: ShipmentInput) => logisticsRepository.createShipment(input),
  updateShipment: (id: string, input: Partial<ShipmentInput>) => logisticsRepository.updateShipment(id, input),
  createShippingNote: (input: ShippingNoteInput) => logisticsRepository.createShippingNote(input),
  updateShippingNote: (id: string, input: Partial<ShippingNoteInput>) => logisticsRepository.updateShippingNote(id, input),
  loadShippingNote: (id: string, userId: string) => logisticsRepository.loadShippingNote(id, userId),
}
