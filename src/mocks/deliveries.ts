import type { Delivery, DeliveryNoteLine, DeliveryStatus } from '@/types'
import { pointAlong } from '../utils/geo'
import { CASA_STOPS, RABAT_STOPS, WAREHOUSE_GEO } from './geo'

const CATALOG: Array<Omit<DeliveryNoteLine, 'quantity'>> = [
  { productId: 'prd-huile', productName: 'Huile végétale 5L', sku: 'HUI-5L', unit: 'bidon' },
  { productId: 'prd-sucre', productName: 'Sucre 1kg', sku: 'SUC-1K', unit: 'sac' },
  { productId: 'prd-lait', productName: 'Lait en poudre', sku: 'LAI-UHT', unit: 'brique' },
  { productId: 'prd-eau', productName: 'Eau 1.5L', sku: 'EAU-15', unit: 'pack' },
  { productId: 'prd-riz', productName: 'Riz 5kg', sku: 'RIZ-5K', unit: 'sac' },
  { productId: 'prd-pate', productName: 'Pâtes 500g', sku: 'PAT-500', unit: 'paquet' },
  { productId: 'prd-farine', productName: 'Farine 10kg', sku: 'FAR-10', unit: 'sac' },
  { productId: 'prd-savon', productName: 'Savon liquide', sku: 'SAV-LIQ', unit: 'flacon' },
]

type Seed = {
  id: string
  client: string
  address: string
  city: string
  status: DeliveryStatus
  time: string
  routeId: string
  driverId: string
  vehicleId: string
  warehouseId: string
  sequence: number
  notes?: string
}

const seeds: Seed[] = [
  { id: 'dlv-481', client: 'Marché Hay Hassani', address: 'Bd Mohamed VI', city: 'Casablanca', status: 'delivered', time: '08:15', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 1 },
  { id: 'dlv-482', client: 'Supermarché Atlas', address: 'Maarif, rue Ibnou Katir', city: 'Casablanca', status: 'at_risk', time: '09:30', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 2, notes: 'Circulation dense — créneau serré' },
  { id: 'dlv-487', client: 'Épicerie Maarif', address: 'Rue Soudanie', city: 'Casablanca', status: 'prepared', time: '09:50', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 3 },
  { id: 'dlv-483', client: 'Épicerie Anfa', address: 'Boulevard d’Anfa', city: 'Casablanca', status: 'prepared', time: '11:00', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 4 },
  { id: 'dlv-489', client: 'Boulangerie Anfa', address: 'Bd d’Anfa', city: 'Casablanca', status: 'prepared', time: '10:45', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 5 },
  { id: 'dlv-484', client: 'Carrefour Ain Diab', address: 'Corniche', city: 'Casablanca', status: 'prepared', time: '13:30', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 6 },
  { id: 'dlv-491', client: 'Pharmacie Ghandi', address: 'Bd Ghandi', city: 'Casablanca', status: 'prepared', time: '11:15', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 7 },
  { id: 'dlv-492', client: 'Casino Bourgogne', address: 'Quartier Bourgogne', city: 'Casablanca', status: 'prepared', time: '11:40', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 8 },
  { id: 'dlv-493', client: 'Marché Central', address: 'Médina', city: 'Casablanca', status: 'prepared', time: '12:10', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 9 },
  { id: 'dlv-494', client: 'Super Croc Racine', address: 'Bd Racine', city: 'Casablanca', status: 'prepared', time: '12:40', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 10 },
  { id: 'dlv-496', client: 'Market Beauséjour', address: 'Beauséjour', city: 'Casablanca', status: 'prepared', time: '14:20', routeId: 'rt-26a', driverId: 'drv-mehdi', vehicleId: 'veh-12', warehouseId: 'wh-casa', sequence: 11 },
  { id: 'dlv-485', client: 'Market Derb Sultan', address: 'Rue des Hôpitaux', city: 'Casablanca', status: 'delivered', time: '08:45', routeId: 'rt-26b', driverId: 'drv-hassan', vehicleId: 'veh-07', warehouseId: 'wh-casa', sequence: 1 },
  { id: 'dlv-486', client: 'Mini Market Oasis', address: 'Californie', city: 'Casablanca', status: 'in_transit', time: '09:10', routeId: 'rt-26b', driverId: 'drv-hassan', vehicleId: 'veh-07', warehouseId: 'wh-casa', sequence: 2 },
  { id: 'dlv-488', client: 'Atacadao Sidi Maârouf', address: 'Sidi Maârouf', city: 'Casablanca', status: 'prepared', time: '10:20', routeId: 'rt-26b', driverId: 'drv-hassan', vehicleId: 'veh-07', warehouseId: 'wh-casa', sequence: 3 },
  { id: 'dlv-495', client: 'Hanout Palmier', address: 'Palmier', city: 'Casablanca', status: 'prepared', time: '13:05', routeId: 'rt-26b', driverId: 'drv-hassan', vehicleId: 'veh-07', warehouseId: 'wh-casa', sequence: 4 },
  { id: 'dlv-497', client: 'Épicerie 2 Mars', address: 'Bd 2 Mars', city: 'Casablanca', status: 'prepared', time: '15:00', routeId: 'rt-26b', driverId: 'drv-hassan', vehicleId: 'veh-07', warehouseId: 'wh-casa', sequence: 5 },
  { id: 'dlv-498', client: 'Relais Aïn Chock', address: 'Aïn Chock', city: 'Casablanca', status: 'prepared', time: '16:10', routeId: 'rt-26b', driverId: 'drv-hassan', vehicleId: 'veh-07', warehouseId: 'wh-casa', sequence: 6 },
  { id: 'dlv-490', client: 'Market Agdal', address: 'Avenue de France', city: 'Rabat', status: 'prepared', time: '09:00', routeId: 'rt-27b', driverId: 'drv-hassan', vehicleId: 'veh-03', warehouseId: 'wh-rabat', sequence: 1 },
]

function progressFor(status: DeliveryStatus) {
  if (status === 'delivered') return 100
  if (status === 'in_transit') return 62
  if (status === 'at_risk') return 38
  if (status === 'failed') return 55
  return 0
}

function linesFor(sequence: number, count = 3): DeliveryNoteLine[] {
  return Array.from({ length: count }, (_, index) => {
    const item = CATALOG[(sequence + index * 2) % CATALOG.length]
    return { ...item, quantity: 4 + ((sequence * 3 + index * 5) % 16) }
  })
}

function signedAt(iso: string) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() + 22)
  return date.toISOString()
}

export const deliveries: Delivery[] = seeds.map((seed) => {
  const warehouse = WAREHOUSE_GEO[seed.warehouseId]
  const location =
    CASA_STOPS[seed.id] ??
    RABAT_STOPS[seed.id] ?? { lat: warehouse.lat, lng: warehouse.lng, label: seed.client }
  const progress = progressFor(seed.status)
  const path = [warehouse, location]
  const currentPosition = pointAlong(path, progress / 100)
  const date = seed.city === 'Rabat' ? '2026-08-27' : '2026-08-26'
  return {
    id: seed.id,
    client: seed.client,
    address: seed.address,
    city: seed.city,
    scheduledAt: `${date}T${seed.time}:00.000Z`,
    status: seed.status,
    driverId: seed.driverId,
    vehicleId: seed.vehicleId,
    routeId: seed.routeId,
    sequence: seed.sequence,
    notes: seed.notes,
    warehouseId: seed.warehouseId,
    location: { ...location, label: seed.client },
    path,
    currentPosition,
    progress,
    lines: linesFor(seed.sequence, 3 + (seed.sequence % 2)),
    signedAt: seed.status === 'delivered' ? signedAt(`${date}T${seed.time}:00.000Z`) : undefined,
    signedBy: seed.status === 'delivered' ? 'Réception magasin' : undefined,
    eta: `${date}T${seed.time}:00.000Z`,
    shippingNoteId: `bl-${seed.id.replace('dlv-', '')}`,
  }
})
