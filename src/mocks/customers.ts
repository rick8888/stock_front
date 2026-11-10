import type { Customer } from '@/types'

export const customers: Customer[] = [
  {
    id: 'cus-habous',
    name: 'Pharmacie des Habous',
    phone: '+212522000111',
    email: 'contact@habous.ma',
    ice: '001234567000012',
    active: true,
    companyId: 'co-atlas',
    addresses: [
      {
        id: 'adr-habous-1',
        label: 'Magasin',
        address: 'Quartier des Habous',
        city: 'Casablanca',
        isDefault: true,
      },
    ],
  },
  {
    id: 'cus-agdal',
    name: 'Superette Agdal',
    phone: '+212537000222',
    email: 'commande@agdal.ma',
    active: true,
    companyId: 'co-atlas',
    addresses: [
      {
        id: 'adr-agdal-1',
        label: 'Point de vente',
        address: 'Avenue Fal Ould Oumeir',
        city: 'Rabat',
        isDefault: true,
      },
      {
        id: 'adr-agdal-2',
        label: 'Entrepôt secondaire',
        address: 'Zone industrielle',
        city: 'Salé',
        isDefault: false,
      },
    ],
  },
  {
    id: 'cus-gueliz',
    name: 'Café Gueliz',
    phone: '+212524000333',
    active: true,
    companyId: 'co-atlas',
    addresses: [
      {
        id: 'adr-gueliz-1',
        label: 'Terrasse',
        address: 'Boulevard Mohammed V',
        city: 'Marrakech',
        isDefault: true,
      },
    ],
  },
]
