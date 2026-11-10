import type { Shipment } from '@/types'
import { pointAlong } from '../utils/geo'
import { deliveries } from './deliveries'
import { WAREHOUSE_GEO } from './geo'
import { routes } from './routes'

function noteIdsForRoute(routeId: string) {
  return deliveries
    .filter((item) => item.routeId === routeId)
    .map((item) => `bl-${item.id.replace('dlv-', '')}`)
}

function linesFromRoute(routeId: string) {
  const map = new Map<string, (typeof deliveries)[number]['lines'][number]>()
  deliveries
    .filter((item) => item.routeId === routeId)
    .forEach((item) => {
      item.lines.forEach((line) => {
        const current = map.get(line.productId)
        if (current) current.quantity += line.quantity
        else map.set(line.productId, { ...line })
      })
    })
  return [...map.values()]
}

const casa = WAREHOUSE_GEO['wh-casa']
const rabat = WAREHOUSE_GEO['wh-rabat']
const marrakech = WAREHOUSE_GEO['wh-marrakech']
const rt26a = routes.find((item) => item.id === 'rt-26a')
const rt26b = routes.find((item) => item.id === 'rt-26b')
export const shipments: Shipment[] = [
  {
    id: 'shp-88',
    originWarehouseId: 'wh-casa',
    destination: 'Tournée Casa centre',
    vehicleId: 'veh-12',
    driverId: 'drv-mehdi',
    routeId: 'rt-26a',
    date: '2026-08-26T07:30:00.000Z',
    status: 'in_transit',
    origin: casa,
    destinationLocation: deliveries.find((item) => item.id === 'dlv-496')?.location ?? casa,
    path: rt26a?.path,
    currentPosition: rt26a?.currentPosition,
    progress: rt26a?.progress ?? 45,
    lines: linesFromRoute('rt-26a'),
    shippingNoteIds: noteIdsForRoute('rt-26a'),
    eta: '2026-08-26T16:30:00.000Z',
  },
  {
    id: 'shp-91',
    originWarehouseId: 'wh-casa',
    destination: 'Tournée Casa sud',
    vehicleId: 'veh-07',
    driverId: 'drv-hassan',
    routeId: 'rt-26b',
    date: '2026-08-26T07:45:00.000Z',
    status: 'in_transit',
    origin: casa,
    destinationLocation: deliveries.find((item) => item.id === 'dlv-498')?.location ?? casa,
    path: rt26b?.path,
    currentPosition: rt26b?.currentPosition,
    progress: rt26b?.progress ?? 30,
    lines: linesFromRoute('rt-26b'),
    shippingNoteIds: noteIdsForRoute('rt-26b'),
    eta: '2026-08-26T16:10:00.000Z',
  },
  {
    id: 'shp-89',
    originWarehouseId: 'wh-rabat',
    destination: 'Tournée Rabat nord',
    vehicleId: 'veh-03',
    driverId: 'drv-hassan',
    routeId: 'rt-27b',
    date: '2026-08-27T07:00:00.000Z',
    status: 'preparing',
    origin: rabat,
    destinationLocation: deliveries.find((item) => item.id === 'dlv-490')?.location ?? rabat,
    path: [rabat, deliveries.find((item) => item.id === 'dlv-490')?.location ?? rabat],
    currentPosition: rabat,
    progress: 0,
    lines: linesFromRoute('rt-27b'),
    shippingNoteIds: noteIdsForRoute('rt-27b'),
    eta: '2026-08-27T12:00:00.000Z',
  },
  {
    id: 'shp-90',
    originWarehouseId: 'wh-casa',
    destination: 'Entrepôt Marrakech',
    destinationWarehouseId: 'wh-marrakech',
    vehicleId: 'veh-12',
    driverId: 'drv-mehdi',
    date: '2026-08-26T06:10:00.000Z',
    status: 'delayed',
    origin: casa,
    destinationLocation: marrakech,
    path: [casa, marrakech],
    currentPosition: pointAlong([casa, marrakech], 0.42),
    progress: 42,
    notes: 'Contrôle gendarmerie à la sortie de Settat — 40 min de retard.',
    eta: '2026-08-26T11:40:00.000Z',
    lines: [
      { productId: 'prd-huile', productName: 'Huile végétale 5L', sku: 'HUI-5L', unit: 'bidon', quantity: 80 },
      { productId: 'prd-farine', productName: 'Farine 10kg', sku: 'FAR-10', unit: 'sac', quantity: 40 },
      { productId: 'prd-riz', productName: 'Riz 5kg', sku: 'RIZ-5K', unit: 'sac', quantity: 36 },
      { productId: 'prd-eau', productName: 'Eau 1.5L', sku: 'EAU-15', unit: 'pack', quantity: 120 },
    ],
    shippingNoteIds: ['bl-transfer-90'],
  },
]
