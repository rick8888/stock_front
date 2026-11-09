import type { Vehicle } from '@/types'

export const vehicles: Vehicle[] = [
  { id: 'veh-12', name: 'Fourgon 12', plate: 'A 45821', status: 'on_mission', warehouseId: 'wh-casa' },
  { id: 'veh-07', name: 'Fourgon 07', plate: 'A 22910', status: 'on_mission', warehouseId: 'wh-casa' },
  { id: 'veh-03', name: 'Camion 03', plate: 'A 11002', status: 'available', warehouseId: 'wh-rabat' },
  { id: 'veh-09', name: 'Fourgon 09', plate: 'A 77441', status: 'maintenance', warehouseId: 'wh-marrakech' },
]
