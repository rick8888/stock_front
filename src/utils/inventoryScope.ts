import type {
  Category,
  InventoryMode,
  InventoryScope,
  Product,
  StockItem,
  StockPlacement,
  WarehouseLocation,
} from '@/types'

export function normalizeInventoryScope(scope?: InventoryScope | null): InventoryScope | undefined {
  if (!scope) return undefined
  const next: InventoryScope = {}
  if (scope.categoryId) next.categoryId = scope.categoryId
  if (scope.locationId) next.locationId = scope.locationId
  if (scope.aisle?.trim()) next.aisle = scope.aisle.trim()
  if (scope.productIds?.length) next.productIds = [...new Set(scope.productIds.filter(Boolean))]
  return Object.keys(next).length ? next : undefined
}

export function inventoryModeFromScope(scope?: InventoryScope | null): InventoryMode {
  return normalizeInventoryScope(scope) ? 'partial' : 'full'
}

export function filterStockForInventory(input: {
  warehouseId: string
  stock: StockItem[]
  products: Product[]
  placements?: StockPlacement[]
  locations?: WarehouseLocation[]
  scope?: InventoryScope | null
}): StockItem[] {
  const scope = normalizeInventoryScope(input.scope)
  const productsById = new Map(input.products.map((item) => [item.id, item]))
  const locationsById = new Map((input.locations ?? []).map((item) => [item.id, item]))

  let productIds: Set<string> | null = null
  if (scope?.productIds?.length) {
    productIds = new Set(scope.productIds)
  }
  if (scope?.categoryId) {
    const inCategory = new Set(
      input.products.filter((item) => item.categoryId === scope.categoryId && !item.archived).map((item) => item.id),
    )
    productIds = productIds
      ? new Set([...productIds].filter((id) => inCategory.has(id)))
      : inCategory
  }
  if (scope?.locationId || scope?.aisle) {
    const locationIds = new Set(
      (input.locations ?? [])
        .filter((loc) => {
          if (loc.warehouseId !== input.warehouseId || loc.active === false) return false
          if (scope.locationId && loc.id !== scope.locationId) return false
          if (scope.aisle && loc.aisle !== scope.aisle) return false
          return true
        })
        .map((loc) => loc.id),
    )
    const placed = new Set(
      (input.placements ?? [])
        .filter(
          (row) =>
            row.warehouseId === input.warehouseId &&
            row.quantity > 0 &&
            row.locationId &&
            locationIds.has(row.locationId),
        )
        .map((row) => row.productId),
    )
    productIds = productIds ? new Set([...productIds].filter((id) => placed.has(id))) : placed
  }

  return input.stock.filter((row) => {
    if (row.warehouseId !== input.warehouseId || row.enabled === false) return false
    if (productIds && !productIds.has(row.productId)) return false
    const product = productsById.get(row.productId)
    if (product?.archived) return false
    if (scope?.locationId || scope?.aisle) {
      // already filtered via placements
      void locationsById
    }
    return true
  })
}

export function inventoryScopeLabel(
  scope: InventoryScope | undefined,
  ctx: { categories: Category[]; locations: WarehouseLocation[]; products?: Product[] },
): string {
  const normalized = normalizeInventoryScope(scope)
  if (!normalized) return 'Entrepôt complet'
  const parts: string[] = []
  if (normalized.categoryId) {
    parts.push(ctx.categories.find((item) => item.id === normalized.categoryId)?.name ?? 'Catégorie')
  }
  if (normalized.aisle) parts.push(`Allée ${normalized.aisle}`)
  if (normalized.locationId) {
    const loc = ctx.locations.find((item) => item.id === normalized.locationId)
    parts.push(loc ? `Empl. ${loc.code}` : 'Emplacement')
  }
  if (normalized.productIds?.length) {
    parts.push(
      normalized.productIds.length === 1
        ? ctx.products?.find((item) => item.id === normalized.productIds![0])?.name ?? '1 article'
        : `${normalized.productIds.length} articles`,
    )
  }
  return parts.length ? parts.join(' · ') : 'Cycle count'
}
