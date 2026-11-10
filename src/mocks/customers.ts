import type { Customer, CustomerAddress, GeoPoint } from '@/types'
import { CITY_GEO, locationFor } from '../utils/geo'
import { CASA_STOPS, RABAT_STOPS, WAREHOUSE_GEO } from './geo'
import { deliveries } from './deliveries'

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function stopGeo(deliveryId: string, client: string, city: string, address: string): GeoPoint {
  return (
    CASA_STOPS[deliveryId] ??
    RABAT_STOPS[deliveryId] ??
    locationFor(city, address, client, WAREHOUSE_GEO['wh-casa'] ?? CITY_GEO.casablanca)
  )
}

function addressOf(
  id: string,
  label: string,
  address: string,
  city: string,
  point: GeoPoint,
  isDefault = true,
): CustomerAddress {
  return {
    id,
    label,
    address,
    city,
    isDefault,
    lat: point.lat,
    lng: point.lng,
  }
}

const byKey = new Map<string, Customer>()

function upsert(
  name: string,
  address: string,
  city: string,
  point: GeoPoint,
  extras?: Partial<Customer> & { addressLabel?: string; addressId?: string },
) {
  const key = `${slug(name)}|${slug(city)}|${slug(address)}`
  const existing = byKey.get(key)
  if (existing) {
    const adr = existing.addresses[0]
    if (adr && (adr.lat == null || adr.lng == null)) {
      adr.lat = point.lat
      adr.lng = point.lng
    }
    return existing
  }
  const id = extras?.id ?? `cus-${slug(name)}`
  const addressId = extras?.addressId ?? `adr-${slug(name)}-1`
  const customer: Customer = {
    id,
    name,
    phone: extras?.phone,
    email: extras?.email,
    ice: extras?.ice,
    notes: extras?.notes,
    active: extras?.active ?? true,
    companyId: extras?.companyId ?? 'co-atlas',
    addresses: [
      addressOf(addressId, extras?.addressLabel ?? 'Livraison', address, city, point),
    ],
  }
  byKey.set(key, customer)
  return customer
}

upsert(
  'Pharmacie des Habous',
  'Quartier des Habous',
  'Casablanca',
  locationFor('Casablanca', 'Quartier des Habous', 'Pharmacie des Habous'),
  {
    id: 'cus-habous',
    phone: '+212522000111',
    email: 'contact@habous.ma',
    ice: '001234567000012',
    addressId: 'adr-habous-1',
    addressLabel: 'Magasin',
  },
)

upsert(
  'Superette Agdal',
  'Avenue Fal Ould Oumeir',
  'Rabat',
  locationFor('Rabat', 'Avenue Fal Ould Oumeir', 'Superette Agdal'),
  {
    id: 'cus-agdal',
    phone: '+212537000222',
    email: 'commande@agdal.ma',
    addressId: 'adr-agdal-1',
    addressLabel: 'Point de vente',
  },
)
{
  const agdal = byKey.get(`${slug('Superette Agdal')}|${slug('Rabat')}|${slug('Avenue Fal Ould Oumeir')}`)
  if (agdal && !agdal.addresses.some((item) => item.id === 'adr-agdal-2')) {
    const sale = locationFor('Salé', 'Zone industrielle', 'Superette Agdal — entrepôt')
    agdal.addresses.push(
      addressOf('adr-agdal-2', 'Entrepôt secondaire', 'Zone industrielle', 'Salé', sale, false),
    )
  }
}

upsert(
  'Café Gueliz',
  'Boulevard Mohammed V',
  'Marrakech',
  locationFor('Marrakech', 'Boulevard Mohammed V', 'Café Gueliz'),
  {
    id: 'cus-gueliz',
    phone: '+212524000333',
    addressId: 'adr-gueliz-1',
    addressLabel: 'Terrasse',
  },
)

for (const delivery of deliveries) {
  upsert(
    delivery.client,
    delivery.address,
    delivery.city,
    stopGeo(delivery.id, delivery.client, delivery.city, delivery.address),
  )
}

const READY_CLIENTS: Array<{ client: string; address: string; city: string }> = [
  { client: 'Pharmacie des Habous', address: 'Quartier des Habous', city: 'Casablanca' },
  { client: 'Café Bianca', address: 'Gauthier, rue du 6 novembre', city: 'Casablanca' },
  { client: 'Superette Racine 2', address: 'Bd Racine', city: 'Casablanca' },
  { client: 'Hanout Mers Sultan', address: 'Mers Sultan', city: 'Casablanca' },
  { client: 'Épicerie Hassan', address: 'Avenue Allal Ben Abdellah', city: 'Rabat' },
  { client: 'Relais Gueliz', address: 'Avenue Mohammed V', city: 'Marrakech' },
  { client: 'Entrepôt Marrakech', address: 'Zone industrielle Sidi Ghanem', city: 'Marrakech' },
]

for (const item of READY_CLIENTS) {
  upsert(item.client, item.address, item.city, locationFor(item.city, item.address, item.client))
}

export const customers: Customer[] = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))

/** Lookup utilisé par les bons de livraison pour rattacher customerId / addressId. */
export function customerFor(client: string, address: string, city: string): Customer | undefined {
  return byKey.get(`${slug(client)}|${slug(city)}|${slug(address)}`)
}
