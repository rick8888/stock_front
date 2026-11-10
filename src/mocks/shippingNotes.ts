import type { DeliveryNoteLine, ShippingNote } from '@/types'
import { deliveryCode } from '../lib/utils'
import { customerFor } from './customers'
import { deliveries } from './deliveries'

const CATALOG: Array<Omit<DeliveryNoteLine, 'quantity'>> = [
  { productId: 'prd-huile', productName: 'Huile végétale 5L', sku: 'HUI-5L', unit: 'bidon' },
  { productId: 'prd-sucre', productName: 'Sucre 1kg', sku: 'SUC-1K', unit: 'sac' },
  { productId: 'prd-lait', productName: 'Lait en poudre', sku: 'LAI-UHT', unit: 'brique' },
  { productId: 'prd-eau', productName: 'Eau 1.5L', sku: 'EAU-15', unit: 'pack' },
  { productId: 'prd-riz', productName: 'Riz 5kg', sku: 'RIZ-5K', unit: 'sac' },
  { productId: 'prd-the', productName: 'Thé vert 200g', sku: 'THE-200', unit: 'boîte' },
]

function linesFor(seed: number, count = 3): DeliveryNoteLine[] {
  return Array.from({ length: count }, (_, index) => {
    const item = CATALOG[(seed + index * 2) % CATALOG.length]
    return { ...item, quantity: 6 + ((seed * 2 + index * 4) % 14) }
  })
}

const ROUTE_SHIPMENT: Record<string, string> = {
  'rt-26a': 'shp-88',
  'rt-26b': 'shp-91',
  'rt-27b': 'shp-89',
}

function withCustomer(note: Omit<ShippingNote, 'id'> & { id: string }): ShippingNote {
  const customer = customerFor(note.client, note.address, note.city)
  const address = customer?.addresses.find((item) => item.isDefault) ?? customer?.addresses[0]
  return {
    ...note,
    customerId: customer?.id,
    addressId: address?.id,
  }
}

const assigned: ShippingNote[] = deliveries.map((delivery) =>
  withCustomer({
    id: `bl-${delivery.id.replace('dlv-', '')}`,
    code: deliveryCode(delivery.id),
    warehouseId: delivery.warehouseId,
    client: delivery.client,
    address: delivery.address,
    city: delivery.city,
    lines: delivery.lines,
    status: delivery.status === 'delivered' ? 'delivered' : 'assigned',
    deliveryId: delivery.id,
    shipmentId: ROUTE_SHIPMENT[delivery.routeId],
    notes: delivery.notes,
  }),
)

const ready: ShippingNote[] = [
  {
    id: 'bl-ready-01',
    code: 'BL-2026-00901',
    warehouseId: 'wh-casa',
    client: 'Pharmacie des Habous',
    address: 'Quartier des Habous',
    city: 'Casablanca',
    lines: linesFor(1, 3),
    status: 'ready',
  },
  {
    id: 'bl-ready-02',
    code: 'BL-2026-00902',
    warehouseId: 'wh-casa',
    client: 'Café Bianca',
    address: 'Gauthier, rue du 6 novembre',
    city: 'Casablanca',
    lines: linesFor(2, 4),
    status: 'ready',
  },
  {
    id: 'bl-ready-03',
    code: 'BL-2026-00903',
    warehouseId: 'wh-casa',
    client: 'Superette Racine 2',
    address: 'Bd Racine',
    city: 'Casablanca',
    lines: linesFor(3, 3),
    status: 'ready',
  },
  {
    id: 'bl-ready-04',
    code: 'BL-2026-00904',
    warehouseId: 'wh-casa',
    client: 'Hanout Mers Sultan',
    address: 'Mers Sultan',
    city: 'Casablanca',
    lines: linesFor(4, 2),
    status: 'ready',
  },
  {
    id: 'bl-ready-05',
    code: 'BL-2026-00905',
    warehouseId: 'wh-rabat',
    client: 'Épicerie Hassan',
    address: 'Avenue Allal Ben Abdellah',
    city: 'Rabat',
    lines: linesFor(5, 3),
    status: 'ready',
  },
  {
    id: 'bl-ready-06',
    code: 'BL-2026-00906',
    warehouseId: 'wh-marrakech',
    client: 'Relais Gueliz',
    address: 'Avenue Mohammed V',
    city: 'Marrakech',
    lines: linesFor(6, 4),
    status: 'ready',
  },
  {
    id: 'bl-transfer-90',
    code: 'BL-2026-00907',
    warehouseId: 'wh-casa',
    client: 'Entrepôt Marrakech',
    address: 'Zone industrielle Sidi Ghanem',
    city: 'Marrakech',
    lines: [
      { productId: 'prd-huile', productName: 'Huile végétale 5L', sku: 'HUI-5L', unit: 'bidon', quantity: 80 },
      { productId: 'prd-farine', productName: 'Farine 10kg', sku: 'FAR-10', unit: 'sac', quantity: 40 },
      { productId: 'prd-riz', productName: 'Riz 5kg', sku: 'RIZ-5K', unit: 'sac', quantity: 36 },
      { productId: 'prd-eau', productName: 'Eau 1.5L', sku: 'EAU-15', unit: 'pack', quantity: 120 },
    ],
    status: 'assigned',
    shipmentId: 'shp-90',
  },
]

export const shippingNotes: ShippingNote[] = [...assigned, ...ready.map((note) => withCustomer(note))]
