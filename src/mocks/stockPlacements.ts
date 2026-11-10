import type { StockPlacement } from '@/types'

export const stockPlacements: StockPlacement[] = [
  {
    id: 'plc-huile-1',
    productId: 'prd-huile',
    warehouseId: 'wh-casa',
    locationId: 'loc-casa-a0101',
    quantity: 80,
    companyId: 'co-atlas',
  },
  {
    id: 'plc-huile-2',
    productId: 'prd-huile',
    warehouseId: 'wh-casa',
    locationId: 'loc-casa-b0201',
    quantity: 40,
    companyId: 'co-atlas',
  },
  {
    id: 'plc-lait-1',
    productId: 'prd-lait',
    warehouseId: 'wh-casa',
    locationId: 'loc-casa-a0102',
    quantity: 120,
    companyId: 'co-atlas',
  },
]
