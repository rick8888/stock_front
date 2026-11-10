import type { StockLot } from '@/types'

export const stockLots: StockLot[] = [
  {
    id: 'lot-huile-1',
    productId: 'prd-huile',
    warehouseId: 'wh-casa',
    lotCode: 'HUI-2608-A',
    expiryDate: '2027-02-15',
    locationId: 'loc-casa-a0101',
    quantity: 80,
    companyId: 'co-atlas',
  },
  {
    id: 'lot-huile-2',
    productId: 'prd-huile',
    warehouseId: 'wh-casa',
    lotCode: 'HUI-2608-B',
    expiryDate: '2027-06-01',
    locationId: 'loc-casa-b0201',
    quantity: 40,
    companyId: 'co-atlas',
  },
  {
    id: 'lot-lait-1',
    productId: 'prd-lait',
    warehouseId: 'wh-casa',
    lotCode: 'LAI-0826',
    expiryDate: '2026-09-20',
    locationId: 'loc-casa-a0102',
    quantity: 120,
    companyId: 'co-atlas',
  },
]
