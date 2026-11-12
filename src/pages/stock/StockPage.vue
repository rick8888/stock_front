<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, ScanLine } from 'lucide-vue-next'
import { useProducts } from '@/composables/useProducts'
import { useStock } from '@/composables/useStock'
import { useProcurement } from '@/composables/useProcurement'
import { usePermissions } from '@/composables/usePermissions'
import { useCurrentUser } from '@/composables/useAuth'
import { useSuppliers } from '@/composables/useSuppliers'
import { useDataStore } from '@/stores/data'
import PageHeader from '@/components/common/PageHeader.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import StockStatusBadge from '@/components/stock/StockStatusBadge.vue'
import StockArticleSheet from '@/components/stock/StockArticleSheet.vue'
import StockMoveSheet from '@/components/stock/StockMoveSheet.vue'
import InventorySessionSheet from '@/components/stock/InventorySessionSheet.vue'
import InventoryStartSheet from '@/components/stock/InventoryStartSheet.vue'
import ReceiveOrderSheet from '@/components/stock/ReceiveOrderSheet.vue'
import ProductFormSheet from '@/components/stock/ProductFormSheet.vue'
import BarcodeScanSheet from '@/components/stock/BarcodeScanSheet.vue'
import { useShippingNotes } from '@/composables/useLogistics'
import RequestFormSheet from '@/components/purchasing/RequestFormSheet.vue'
import ShippingNoteFormSheet from '@/components/logistics/ShippingNoteFormSheet.vue'
import { useCustomers } from '@/composables/useCustomers'
import { useLocations } from '@/composables/useLocations'
import { useActionBusy } from '@/composables/useActionBusy'
import { toast } from 'vue-sonner'
import { formatNumber, formatDateTime } from '@/lib/utils'
import { MOVEMENT_LABEL } from '@/config/stock'
import { isOnline } from '@/offline/outbox'
import { inventoryScopeLabel } from '@/utils/inventoryScope'
import type { ProductInput, ShippingNoteInput } from '@/repositories/interfaces'
import type {
  InventoryScope,
  InventorySession,
  Product,
  StockHealth,
  StockMovementType,
  StockOverviewRow,
  Warehouse,
} from '@/types'

const route = useRoute()
const router = useRouter()
const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { products, createProduct, updateProduct } = useProducts()
const {
  overview,
  counts,
  loading,
  error,
  transferStock,
  recommendationFor,
  movementsFor,
  requestsFor,
  ordersFor,
  movements,
  inventories,
  warehouses,
  allWarehouses,
  pendingReceipts,
  orders,
  productName,
  warehouseName,
  userName,
  exportMovements,
  startInventory,
  saveInventory,
  submitInventory,
  completeInventory,
  receiveOrderLines,
  ensureReceipt,
  closeDay,
  isClosed,
  boardToday,
} = useStock()
const { createRequest } = useProcurement({ autoload: false })
const { createShippingNote } = useShippingNotes()
const { customers } = useCustomers()
const { suppliers } = useSuppliers()
const { locations: apiLocations } = useLocations()
const store = useDataStore()
const { busy, run, isBusy } = useActionBusy()

const inventoryLocations = computed(() =>
  apiLocations.value.length ? apiLocations.value : store.db.warehouseLocations,
)

const query = ref('')
const warehouseId = ref('all')
const status = ref<'all' | StockHealth>('all')
const page = ref(1)
const pageSize = 8

const selected = ref<StockOverviewRow | null>(null)
const productOpen = ref(false)
const editingProduct = ref<Product | null>(null)
const supplyOpen = ref(false)
const supplyQty = ref('130')
const noteFormOpen = ref(false)
const moveOpen = ref(false)
const moveKind = ref<StockMovementType>('transfer')
const moveError = ref('')
const scanOpen = ref(false)
const orderOpen = ref(false)
const orderError = ref('')
const inventoryOpen = ref(false)
const inventoryStartOpen = ref(false)
const inventoryStartWarehouse = ref<Warehouse | null>(null)
const inventorySession = ref<InventorySession | null>(null)
const inventoryError = ref('')
const closeError = ref('')
const closeWarehouse = ref('')
const movType = ref<'all' | StockMovementType>('all')
const movWarehouse = ref('all')
const movFrom = ref('')
const movTo = ref('')

const tab = computed(() => (typeof route.query.tab === 'string' ? route.query.tab : 'overview'))
const headers: Record<string, { title: string; description: string }> = {
  overview: { title: 'Stock', description: 'Ce qui est critique d’abord. Le détail ensuite.' },
  movements: { title: 'Mouvements', description: 'Journal complet, filtrable et exportable.' },
  inventory: {
    title: 'Inventaire',
    description: 'Complet ou cycle count ciblé — comptez, constatez l’écart, ajustez.',
  },
  close: { title: 'Clôture', description: 'Pointer réceptions, inventaire et sorties avant de fermer la journée.' },
}
const header = computed(() => headers[tab.value] ?? headers.overview)

const tabs = [
  { id: 'overview', label: 'Articles' },
  { id: 'movements', label: 'Journal' },
  { id: 'inventory', label: 'Inventaire' },
  { id: 'close', label: 'Clôture' },
]

function setTab(id: string) {
  void router.replace({ query: id === 'overview' ? {} : { tab: id } })
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return overview.value.filter((row) => {
    if (warehouseId.value !== 'all' && row.warehouseId !== warehouseId.value) return false
    if (status.value !== 'all' && row.status !== status.value) return false
    if (q && !`${row.productName} ${row.sku} ${row.warehouseName} ${row.barcode ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
})

const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch([query, warehouseId, status], () => {
  page.value = 1
})

watch(query, (value) => {
  const code = value.trim()
  if (!/^\d{8,14}$/.test(code)) return
  const row = overview.value.find((item) => item.barcode === code)
  if (row) selectRow(row)
})

const chips = computed(() => [
  { id: 'all' as const, label: 'Tous', count: counts.value.all },
  { id: 'critical' as const, label: 'Critiques', count: counts.value.critical },
  { id: 'watch' as const, label: 'À surveiller', count: counts.value.watch },
  { id: 'on_order' as const, label: 'En commande', count: counts.value.on_order },
  { id: 'normal' as const, label: 'Normal', count: counts.value.normal },
])

function toneBar(row: StockOverviewRow) {
  return {
    critical: 'border-l-red-500',
    watch: 'border-l-amber-500',
    on_order: 'border-l-sky-500',
    normal: 'border-l-transparent',
  }[row.status]
}

async function saveProduct(payload: { id?: string; input: ProductInput }) {
  await run(async () => {
    if (payload.id) await updateProduct(payload.id, payload.input)
    else await createProduct(payload.input)
    productOpen.value = false
    editingProduct.value = null
  })
}

function enrichRow(row: StockOverviewRow): StockOverviewRow {
  const product = products.value.find((item) => item.id === row.productId)
  if (!product) return row
  const images = product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : row.images
  return {
    ...row,
    imageUrl: row.imageUrl ?? product.images?.[0] ?? product.imageUrl,
    images,
    description: product.description ?? row.description,
  }
}

function selectRow(row: StockOverviewRow) {
  selected.value = enrichRow(row)
}

function openNewProduct() {
  editingProduct.value = null
  productOpen.value = true
}

function openEditProduct(productId: string) {
  editingProduct.value = products.value.find((item) => item.id === productId) ?? null
  productOpen.value = true
}

watch(overview, (list) => {
  if (!selected.value) return
  const next = list.find((item) => item.id === selected.value?.id)
  if (next) selectRow(next)
})

watch(
  () => [route.query.article, route.query.warehouse, overview.value] as const,
  () => {
    const article = route.query.article
    if (typeof article !== 'string' || !article) return
    const warehouse = typeof route.query.warehouse === 'string' ? route.query.warehouse : ''
    const row =
      overview.value.find((item) => item.productId === article && (!warehouse || item.warehouseId === warehouse)) ??
      overview.value.find((item) => item.productId === article)
    if (row) selectRow(row)
  },
  { immediate: true },
)

watch(
  () => [route.query.session, inventories.value] as const,
  () => {
    const id = route.query.session
    if (typeof id !== 'string' || !id) return
    const session = inventories.value.find((item) => item.id === id)
    if (session) openInventory(session)
  },
)

const canApproveInventory = computed(() =>
  ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(currentUser.value?.role ?? ''),
)

async function onMove(payload: {
  type: StockMovementType
  productId: string
  warehouseId: string
  quantity: number
  note: string
  toWarehouseId?: string
}) {
  await run(async () => {
    moveError.value = ''
    if (payload.type !== 'transfer') {
      throw new Error('Ce mouvement n’est possible que via une pièce (BR, BL, DA ou inventaire).')
    }
    if (!payload.toWarehouseId) throw new Error('Entrepôt de destination requis')
    await transferStock(payload.productId, payload.warehouseId, payload.toWarehouseId, payload.quantity, payload.note)
    moveOpen.value = false
  }).catch((err) => {
    moveError.value = err instanceof Error ? err.message : 'Mouvement impossible'
  })
}

function openMove(kind: StockMovementType, row: StockOverviewRow | null = selected.value) {
  if (kind !== 'transfer') return
  if (row) selectRow(row)
  moveKind.value = 'transfer'
  moveError.value = ''
  moveOpen.value = true
}

function onBarcode(code: string) {
  query.value = code
  const row =
    overview.value.find((item) => item.barcode === code) ??
    overview.value.find((item) => item.sku.toLowerCase() === code.toLowerCase())
  if (row) selectRow(row)
}

function onSearchEnter() {
  const code = query.value.trim()
  if (!code) return
  onBarcode(code)
}

function exportArticle() {
  if (!selected.value) return
  exportMovements(
    movementsFor(selected.value.productId, selected.value.warehouseId),
    `mouvements-${selected.value.sku || selected.value.productId}`,
  )
}

const visibleMovements = computed(() =>
  movements.value.filter((item) => {
    if (movType.value !== 'all' && item.type !== movType.value) return false
    if (movWarehouse.value !== 'all') {
      if (item.fromWarehouseId !== movWarehouse.value && item.toWarehouseId !== movWarehouse.value) return false
    }
    const key = item.date.slice(0, 10)
    if (movFrom.value && key < movFrom.value) return false
    if (movTo.value && key > movTo.value) return false
    return true
  }),
)

function openStartInventory(warehouseId: string) {
  inventoryError.value = ''
  inventoryStartWarehouse.value = warehouses.value.find((item) => item.id === warehouseId) ?? null
  inventoryStartOpen.value = true
}

async function onStartInventory(payload: { warehouseId: string; scope?: InventoryScope }) {
  inventoryStartOpen.value = false
  await run(async () => {
    inventoryError.value = ''
    try {
      inventorySession.value = await startInventory(payload.warehouseId, payload.scope)
      inventoryOpen.value = true
    } catch (err) {
      inventoryError.value = err instanceof Error ? err.message : 'Inventaire impossible'
    }
  }, `inv-${payload.warehouseId}`)
}

function scopeLabelFor(session: InventorySession) {
  return inventoryScopeLabel(session.scope, {
    categories: store.db.categories,
    locations: inventoryLocations.value,
    products: products.value,
  })
}

function openInventory(session: InventorySession) {
  inventorySession.value = session
  inventoryError.value = ''
  inventoryOpen.value = true
}

function closeInventory() {
  inventoryOpen.value = false
  inventorySession.value = null
  if (route.query.session) {
    const query = { ...route.query }
    delete query.session
    void router.replace({ query })
  }
}

function closeArticle() {
  selected.value = null
  if (route.query.article || route.query.warehouse) {
    const query = { ...route.query }
    delete query.article
    delete query.warehouse
    void router.replace({ query })
  }
}

async function onSaveInventory(lines: { productId: string; counted: number }[]) {
  if (!inventorySession.value) return
  await run(async () => {
    inventoryError.value = ''
    try {
      const saved = await saveInventory(inventorySession.value!.id, lines)
      inventorySession.value = saved
      if (!isOnline() || (saved && '_offlineQueued' in saved)) {
        toast.message('Inventaire sauvegardé hors ligne', {
          description: 'Les quantités seront synchronisées au retour réseau.',
        })
      }
    } catch (err) {
      inventoryError.value = err instanceof Error ? err.message : 'Enregistrement impossible'
    }
  })
}

async function onSubmitInventory(lines: { productId: string; counted: number }[]) {
  if (!inventorySession.value) return
  if (!isOnline()) {
    inventoryError.value = 'Soumission impossible hors ligne — enregistrez d’abord, sync plus tard.'
    await onSaveInventory(lines)
    return
  }
  await run(async () => {
    inventoryError.value = ''
    try {
      await saveInventory(inventorySession.value!.id, lines)
      inventorySession.value = await submitInventory(inventorySession.value!.id)
      closeInventory()
    } catch (err) {
      inventoryError.value = err instanceof Error ? err.message : 'Soumission impossible'
    }
  })
}

async function onCompleteInventory(lines: { productId: string; counted: number }[]) {
  if (!inventorySession.value) return
  if (!isOnline()) {
    inventoryError.value = 'Clôture impossible hors ligne — enregistrez d’abord, sync plus tard.'
    await onSaveInventory(lines)
    return
  }
  await run(async () => {
    inventoryError.value = ''
    try {
      await saveInventory(inventorySession.value!.id, lines)
      await completeInventory(inventorySession.value!.id)
      closeInventory()
    } catch (err) {
      inventoryError.value = err instanceof Error ? err.message : 'Clôture impossible'
    }
  })
}

async function onEnsureOrder(orderId: string) {
  await run(async () => {
    orderError.value = ''
    try {
      await ensureReceipt(orderId)
    } catch (err) {
      orderError.value = err instanceof Error ? err.message : 'Création impossible'
    }
  })
}

async function onReceiveOrder(payload: { receiptId: string; lines: { productId: string; received: number }[] }) {
  await run(async () => {
    orderError.value = ''
    try {
      await receiveOrderLines(payload.receiptId, payload.lines)
      orderOpen.value = false
    } catch (err) {
      orderError.value = err instanceof Error ? err.message : 'Réception impossible'
    }
  })
}

async function onCloseDay() {
  if (!closeWarehouse.value) return
  await run(async () => {
    closeError.value = ''
    try {
      await closeDay(closeWarehouse.value)
    } catch (err) {
      closeError.value = err instanceof Error ? err.message : 'Clôture impossible'
    }
  })
}

const closePendingReceipts = computed(() =>
  pendingReceipts.value.filter((item) => !closeWarehouse.value || item.warehouseId === closeWarehouse.value),
)
const closeOpenInventory = computed(() =>
  inventories.value.filter(
    (item) =>
      (item.status === 'in_progress' || item.status === 'pending_review') &&
      (!closeWarehouse.value || item.warehouseId === closeWarehouse.value),
  ),
)
const closeTodayMoves = computed(() => {
  const today = boardToday.value
  if (!today) return []
  return movements.value.filter(
    (item) =>
      item.date.slice(0, 10) === today &&
      (!closeWarehouse.value ||
        item.fromWarehouseId === closeWarehouse.value ||
        item.toWarehouseId === closeWarehouse.value),
  )
})

/** Crée la DA tout de suite (le libellé du bouton promet une création, pas un second formulaire). */
async function createSupplyFromRecommendation(row: StockOverviewRow, quantity: number) {
  if (!currentUser.value) {
    toast.error('Session expirée — reconnectez-vous.')
    return
  }
  if (!can('procurement.create')) {
    toast.error('Permission refusée pour créer un approvisionnement.')
    return
  }
  if (busy.value) {
    toast.message('Une autre action est en cours…')
    return
  }
  selectRow(row)
  const qty = Math.max(1, Math.round(Number(quantity) || 0))
  try {
    await run(async () => {
      await createRequest(
        row.warehouseId,
        [{ productId: row.productId, quantity: qty }],
        `Recommandation stock — ${row.productName}`,
        { priority: row.status === 'critical' ? 'high' : 'medium', status: 'submitted' },
      )
      toast.success(`Demande créée — ${qty} ${row.unit}s`)
      closeArticle()
    })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Création de la demande impossible')
  }
}

async function submitSupply(payload: {
  warehouseId: string
  items: { productId: string; quantity: number }[]
  note: string
  priority: 'high' | 'medium' | 'low'
  asDraft: boolean
}) {
  if (!selected.value || !currentUser.value) return
  try {
    await run(async () => {
      const names = payload.items
        .map((line) => products.value.find((item) => item.id === line.productId)?.name ?? line.productId)
        .join(', ')
      await createRequest(
        payload.warehouseId,
        payload.items,
        payload.note || `Recommandation stock — ${names}`,
        { priority: payload.priority, status: payload.asDraft ? 'draft' : 'submitted' },
      )
      supplyOpen.value = false
      toast.success('Demande d’approvisionnement enregistrée')
    })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Création impossible')
  }
}

async function saveShippingNote(payload: { id?: string; input: ShippingNoteInput }) {
  await run(async () => {
    await createShippingNote({ ...payload.input, createdByUserId: currentUser.value?.id })
    noteFormOpen.value = false
  })
}

const supplyLines = computed(() =>
  selected.value ? [{ productId: selected.value.productId, quantity: Number(supplyQty.value) || 1 }] : [],
)

const articleRec = computed(() => (selected.value ? recommendationFor(selected.value) : null))
const articleMovements = computed(() =>
  selected.value ? movementsFor(selected.value.productId, selected.value.warehouseId, 24) : [],
)
const articleRequests = computed(() =>
  selected.value ? requestsFor(selected.value.productId, selected.value.warehouseId) : [],
)
const articleOrders = computed(() =>
  selected.value ? ordersFor(selected.value.productId, selected.value.warehouseId) : [],
)
</script>

<template>
  <div class="page-wide">
    <PageHeader :title="header.title" :description="header.description">
      <template #actions>
        <div class="flex gap-2">
          <Button v-if="tab === 'overview' && can('delivery.prepare')" size="sm" variant="outline" @click="noteFormOpen = true">
            Préparer un bon
          </Button>
          <Button v-if="can('stock.receive')" size="sm" variant="outline" @click="orderOpen = true">Réceptionner une commande</Button>
          <Button v-if="tab === 'movements'" size="sm" variant="outline" :disabled="!visibleMovements.length" @click="exportMovements(visibleMovements)">
            Exporter
          </Button>
          <Button v-if="tab === 'overview' && can('product.create')" size="sm" @click="openNewProduct">Ajouter un produit</Button>
        </div>
      </template>
    </PageHeader>

    <ErrorState v-if="!can('stock.view')" message="Vous n’avez pas accès au stock." />
    <PageSkeleton v-else-if="loading" />
    <ErrorState v-else-if="error" :message="error" />
    <template v-else>
      <div class="mb-5 flex flex-wrap gap-1.5">
        <button
          v-for="item in tabs"
          :key="item.id"
          class="chip"
          :class="tab === item.id ? 'chip-active' : 'border-border/60 bg-card'"
          @click="setTab(item.id)"
        >
          {{ item.label }}
        </button>
      </div>

      <div v-if="tab === 'overview'">
      <div class="metric-strip mb-5 sm:grid-cols-2 xl:grid-cols-4">
        <button
          class="metric-item"
          :class="status === 'critical' ? 'bg-muted/50' : ''"
          @click="status = 'critical'"
        >
          <p class="metric-label text-red-700 dark:text-red-400">Critiques</p>
          <p class="metric-value tabular-nums text-red-700 dark:text-red-400">{{ counts.critical }}</p>
        </button>
        <button
          class="metric-item"
          :class="status === 'watch' ? 'bg-muted/50' : ''"
          @click="status = 'watch'"
        >
          <p class="metric-label text-amber-700 dark:text-amber-400">À surveiller</p>
          <p class="metric-value tabular-nums text-amber-700 dark:text-amber-400">{{ counts.watch }}</p>
        </button>
        <button
          class="metric-item"
          :class="status === 'on_order' ? 'bg-muted/50' : ''"
          @click="status = 'on_order'"
        >
          <p class="metric-label text-sky-700 dark:text-sky-400">En commande</p>
          <p class="metric-value tabular-nums text-sky-700 dark:text-sky-400">{{ counts.on_order }}</p>
        </button>
        <button
          class="metric-item"
          :class="status === 'normal' ? 'bg-muted/50' : ''"
          @click="status = 'normal'"
        >
          <p class="metric-label text-emerald-700 dark:text-emerald-400">Normal</p>
          <p class="metric-value tabular-nums text-emerald-700 dark:text-emerald-400">{{ counts.normal }}</p>
        </button>
      </div>

      <div class="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            class="pl-8 pr-10"
            placeholder="Rechercher ou scanner un code-barres…"
            @keydown.enter.prevent="onSearchEnter"
          />
          <button
            type="button"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Scanner"
            @click="scanOpen = true"
          >
            <ScanLine class="size-3.5" />
          </button>
        </div>
        <select v-model="warehouseId" class="field md:w-48">
          <option value="all">Tous les entrepôts</option>
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
      </div>

      <div class="mb-3 flex flex-wrap gap-1.5">
        <button
          v-for="chip in chips"
          :key="chip.id"
          class="chip border-border/60 bg-card"
          :class="status === chip.id ? 'chip-active' : ''"
          @click="status = chip.id"
        >
          {{ chip.label }}
          <span class="tabular-nums text-muted-foreground">{{ chip.count }}</span>
        </button>
      </div>

      <EmptyState v-if="!visible.length" title="Aucun article dans ce filtre." />
      <div v-else class="data-list">
        <button
          v-for="row in visible"
          :key="row.id"
          class="data-row border-l-2"
          :class="toneBar(row)"
          @click="selectRow(row)"
        >
          <div class="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
            <img v-if="row.imageUrl" :src="row.imageUrl" :alt="row.productName" class="size-full object-cover" />
            <div v-else class="flex size-full items-center justify-center text-[9px] text-muted-foreground">IMG</div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <p class="text-[13px] font-medium">{{ row.productName }}</p>
              <StockStatusBadge :status="row.status" :on-order="row.flags.onOrder" />
            </div>
            <p class="mt-0.5 text-[11px] text-muted-foreground">
              {{ row.warehouseName }} · {{ row.sku }}
              <span v-if="row.barcode"> · {{ row.barcode }}</span>
              · couverture {{ row.days < 99 ? `${row.days} j` : '—' }}
            </p>
          </div>
          <div class="hidden shrink-0 text-right sm:block">
            <p class="text-[13px] font-semibold tabular-nums">{{ formatNumber(row.available) }} <span class="text-[11px] font-normal text-muted-foreground">dispo.</span></p>
            <p class="text-[11px] text-muted-foreground">{{ formatNumber(row.reserved) }} rés. · {{ formatNumber(row.inTransit) }} cmd.</p>
          </div>
        </button>
      </div>

      <div v-if="pages > 1" class="mt-3 flex items-center justify-between text-[13px]">
        <p class="text-muted-foreground">{{ filtered.length }} articles</p>
        <div class="flex gap-1.5">
          <Button size="sm" variant="outline" :disabled="page === 1" @click="page -= 1">Précédent</Button>
          <Button size="sm" variant="outline" :disabled="page === pages" @click="page += 1">Suivant</Button>
        </div>
      </div>
      </div>

      <div v-else-if="tab === 'movements'" class="space-y-3">
        <div class="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
          <select v-model="movType" class="field">
            <option value="all">Tous les types</option>
            <option v-for="(label, key) in MOVEMENT_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
          <select v-model="movWarehouse" class="field">
            <option value="all">Tous les entrepôts</option>
            <option v-for="item in warehouses" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
          <Input v-model="movFrom" type="date" class="md:w-40" />
          <Input v-model="movTo" type="date" class="md:w-40" />
        </div>
        <EmptyState v-if="!visibleMovements.length" title="Aucun mouvement dans ce filtre." />
        <div v-else class="data-list">
          <article v-for="item in visibleMovements" :key="item.id" class="data-row flex-wrap justify-between">
            <div>
              <p class="text-[13px] font-medium">{{ MOVEMENT_LABEL[item.type] }} · {{ productName(item.productId) }}</p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">
                <span v-if="item.reference" class="font-medium text-foreground">{{ item.reference }} · </span>
                {{ warehouseName(item.fromWarehouseId) }}
                <span v-if="item.toWarehouseId"> → {{ warehouseName(item.toWarehouseId) }}</span>
                · {{ userName(item.userId) }} · {{ item.note }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-[13px] font-semibold tabular-nums">{{ item.quantity }}</p>
              <p class="text-[11px] text-muted-foreground">{{ formatDateTime(item.date) }}</p>
            </div>
          </article>
        </div>
      </div>

      <div v-else-if="tab === 'inventory'" class="space-y-4">
        <p v-if="inventoryError" class="text-sm text-destructive">{{ inventoryError }}</p>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="item in warehouses"
            :key="item.id"
            size="sm"
            variant="outline"
            :disabled="!can('stock.inventory')"
            :loading="isBusy(`inv-${item.id}`)"
            @click="openStartInventory(item.id)"
          >
            Inventorier {{ item.name }}
          </Button>
        </div>
        <EmptyState
          v-if="!inventories.length"
          title="Aucun inventaire"
          description="Démarrez un inventaire complet ou un cycle count ciblé."
        />
        <article
          v-for="session in inventories"
          :key="session.id"
          class="surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
          @click="openInventory(session)"
        >
          <div>
            <p class="text-sm font-semibold">{{ warehouseName(session.warehouseId) }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ session.mode === 'partial' ? 'Cycle count' : 'Complet' }} · {{ scopeLabelFor(session) }}
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ session.counted }} / {{ session.expected }} · {{ session.lines?.length ?? 0 }} articles
            </p>
          </div>
          <span class="text-xs font-medium">
            {{
              session.status === 'completed'
                ? 'Clôturé'
                : session.status === 'pending_review'
                  ? 'À valider'
                  : 'En cours'
            }}
          </span>
        </article>
      </div>

      <div v-else class="space-y-4">
        <select v-model="closeWarehouse" class="h-10 rounded-lg border bg-card px-3 text-sm md:w-64">
          <option value="">Choisir un entrepôt</option>
          <option v-for="item in warehouses" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <p v-if="closeWarehouse && isClosed(closeWarehouse)" class="text-sm font-medium text-emerald-700">
          Journée clôturée pour cet entrepôt.
        </p>
        <article class="surface px-4 py-3">
          <p class="text-sm font-semibold">Réceptions ouvertes</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ closePendingReceipts.length }} bon(s) non validé(s)</p>
        </article>
        <article class="surface px-4 py-3">
          <p class="text-sm font-semibold">Inventaires en cours</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ closeOpenInventory.length }}</p>
        </article>
        <article class="surface px-4 py-3">
          <p class="text-sm font-semibold">Mouvements du jour</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ closeTodayMoves.length }} ligne(s)</p>
        </article>
        <p v-if="closeError" class="text-sm text-destructive">{{ closeError }}</p>
        <Button
          :loading="busy"
          :disabled="!closeWarehouse || isClosed(closeWarehouse) || !(can('stock.inventory') || can('stock.adjust'))"
          @click="onCloseDay"
        >
          Clôturer la journée
        </Button>
      </div>
    </template>

    <StockArticleSheet
      :open="!!selected && !supplyOpen"
      :row="selected"
      :recommendation="articleRec"
      :movements="articleMovements"
      :requests="articleRequests"
      :orders="articleOrders"
      @close="closeArticle"
      @supply="createSupplyFromRecommendation"
      @edit="openEditProduct"
      @move="openMove"
      @receive-order="orderOpen = true"
      @inventory="setTab('inventory')"
      @export="exportArticle"
    />

    <RequestFormSheet
      :open="supplyOpen"
      title="Créer un approvisionnement"
      :products="products"
      :warehouses="warehouses"
      :initial-warehouse-id="selected?.warehouseId"
      :initial-lines="supplyLines"
      :initial-note="selected ? `Recommandation stock — ${selected.productName}` : ''"
      lock-warehouse
      @close="supplyOpen = false"
      @submit="submitSupply"
    />

    <ShippingNoteFormSheet
      :open="noteFormOpen"
      :warehouses="warehouses"
      :products="products"
      :customers="customers"
      @close="noteFormOpen = false"
      @submit="saveShippingNote"
    />
    <ProductFormSheet
      :open="productOpen"
      :product="editingProduct"
      :categories="store.db.categories"
      :suppliers="suppliers"
      @close="productOpen = false; editingProduct = null"
      @submit="saveProduct"
    />
    <BarcodeScanSheet :open="scanOpen" @close="scanOpen = false" @detect="onBarcode" />
    <StockMoveSheet
      :open="moveOpen"
      :kind="moveKind"
      :row="selected"
      :warehouses="allWarehouses"
      :products="products"
      :error="moveError"
      @close="moveOpen = false"
      @submit="onMove"
    />
    <InventoryStartSheet
      :open="inventoryStartOpen"
      :warehouse="inventoryStartWarehouse"
      :categories="store.db.categories"
      :locations="inventoryLocations"
      @close="inventoryStartOpen = false; inventoryStartWarehouse = null"
      @start="onStartInventory"
    />
    <InventorySessionSheet
      :open="inventoryOpen"
      :session="inventorySession"
      :products="products"
      :warehouse-name="inventorySession ? warehouseName(inventorySession.warehouseId) : ''"
      :scope-label="inventorySession ? scopeLabelFor(inventorySession) : ''"
      :error="inventoryError"
      :can-count="can('stock.inventory')"
      :can-approve="canApproveInventory"
      :counted-by-name="inventorySession?.countedByUserId ? userName(inventorySession.countedByUserId) : ''"
      @close="closeInventory"
      @save="onSaveInventory"
      @submit="onSubmitInventory"
      @complete="onCompleteInventory"
    />
    <ReceiveOrderSheet
      :open="orderOpen"
      :receipts="pendingReceipts"
      :orders="orders"
      :products="products"
      :error="orderError"
      @close="orderOpen = false"
      @ensure="onEnsureOrder"
      @submit="onReceiveOrder"
    />
  </div>
</template>
