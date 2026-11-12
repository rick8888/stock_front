<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProcurement } from '@/composables/useProcurement'
import { usePermissions } from '@/composables/usePermissions'
import { useCurrentUser } from '@/composables/useAuth'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import RequestStatusBadge from '@/components/purchasing/RequestStatusBadge.vue'
import RequestDetailSheet from '@/components/purchasing/RequestDetailSheet.vue'
import RequestFormSheet from '@/components/purchasing/RequestFormSheet.vue'
import SupplierFormSheet from '@/components/purchasing/SupplierFormSheet.vue'
import ReceiptDetailSheet from '@/components/purchasing/ReceiptDetailSheet.vue'
import OrderDetailSheet from '@/components/purchasing/OrderDetailSheet.vue'
import OrderStatusBadge from '@/components/purchasing/OrderStatusBadge.vue'
import { formatMoney, formatDateTime, formatDate } from '@/lib/utils'
import { RECEIPT_LABEL } from '@/services/receipt.overview'
import { orderEtaLabel } from '@/services/order.overview'
import type { RequestOverview } from '@/services/request.overview'
import type { ReceiptOverview } from '@/services/receipt.overview'
import type { QuoteFile, Supplier } from '@/types'
import type { OrderOverview } from '@/services/order.overview'
import type { SupplierInput } from '@/repositories/interfaces'

const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { run } = useActionBusy()
const {
  overviews,
  orderOverviews,
  receiptOverviews,
  supplierRows,
  counts,
  page,
  pages,
  total,
  products,
  warehouses,
  suppliers,
  sourcingOffers,
  loadBoard,
  loadSourcing,
  createRequest,
  approveRequest,
  takeCharge,
  issueFromRequest,
  createOrderFromOffer,
  launchConsultation,
  awardQuote,
  cancelConsultation,
  attachQuoteFile,
  confirmOrder,
  ensureOrderReceipt,
  validateReceipt,
  groupableWith,
  isReadyToPurchase,
  rejectRequest,
  requestChanges,
  createSupplier,
  updateSupplier,
  loading,
  error,
} = useProcurement({ autoload: false })
const route = useRoute()
const router = useRouter()

const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : defaultTab())
watch(
  () => route.query.tab,
  (value) => {
    if (typeof value === 'string') tab.value = value
  },
)
const tabs = [
  { id: 'requests', label: 'Demandes d’achat' },
  { id: 'orders', label: 'Commandes' },
  { id: 'receipts', label: 'Réceptions' },
  { id: 'suppliers', label: 'Fournisseurs' },
]

const filter = ref<'all' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'ordered' | 'expired'>(defaultFilter())
const selected = ref<RequestOverview | null>(null)
const groupIds = ref<string[]>([])
const selectedReceipt = ref<ReceiptOverview | null>(null)
const selectedOrder = ref<OrderOverview | null>(null)
const receiptFilter = ref<'all' | 'pending' | 'partial' | 'validated'>('pending')
const orderFilter = ref<'open' | 'delayed' | 'received' | 'all'>('open')
const supplierFilter = ref<'all' | 'active' | 'pending'>('all')
const listPage = ref(1)
const reqOpen = ref(false)
const supOpen = ref(false)
const editingSupplier = ref<Supplier | null>(null)

const filtered = computed(() => overviews.value)
const filteredOrders = computed(() => orderOverviews.value)
const filteredReceipts = computed(() => receiptOverviews.value)

const chips = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: counts.value.all ?? 0 },
  { id: 'submitted' as const, label: 'À valider', count: counts.value.submitted ?? 0 },
  { id: 'in_review' as const, label: 'En validation', count: counts.value.in_review ?? 0 },
  { id: 'approved' as const, label: 'Validées / à traiter', count: counts.value.approved ?? 0 },
  { id: 'rejected' as const, label: 'Rejetées', count: counts.value.rejected ?? 0 },
  { id: 'ordered' as const, label: 'Traitées', count: counts.value.ordered ?? 0 },
  ...(counts.value.expired
    ? [{ id: 'expired' as const, label: 'Périmées', count: counts.value.expired }]
    : []),
])

const orderChips = computed(() => [
  { id: 'open' as const, label: 'En cours', count: counts.value.open ?? 0 },
  { id: 'delayed' as const, label: 'En retard', count: counts.value.delayed ?? 0 },
  { id: 'received' as const, label: 'Reçues', count: counts.value.received ?? 0 },
  { id: 'all' as const, label: 'Toutes', count: counts.value.all ?? 0 },
])

const receiptChips = computed(() => [
  { id: 'pending' as const, label: 'À faire', count: counts.value.pending ?? 0 },
  { id: 'partial' as const, label: 'Écarts', count: counts.value.partial ?? 0 },
  { id: 'validated' as const, label: 'Validées', count: counts.value.validated ?? 0 },
  { id: 'all' as const, label: 'Toutes', count: counts.value.all ?? 0 },
])

const supplierChips = computed(() => [
  { id: 'all' as const, label: 'Tous', count: counts.value.all ?? 0 },
  { id: 'active' as const, label: 'Actifs', count: counts.value.active ?? 0 },
  { id: 'pending' as const, label: 'En attente', count: counts.value.pending ?? 0 },
])

function sectionOfTab(value: string): 'requests' | 'orders' | 'receipts' | 'suppliers' | null {
  if (value === 'orders') return 'orders'
  if (value === 'receipts') return 'receipts'
  if (value === 'suppliers') return 'suppliers'
  if (value === 'requests') return 'requests'
  return null
}

function activeFilter() {
  if (tab.value === 'orders') return orderFilter.value
  if (tab.value === 'receipts') return receiptFilter.value
  if (tab.value === 'suppliers') return supplierFilter.value
  return filter.value
}

function reloadBoard(silent = true) {
  const section = sectionOfTab(tab.value)
  if (!section) return
  void loadBoard(
    {
      section,
      filter: activeFilter(),
      page: listPage.value,
      pageSize: 8,
      focusId:
        typeof route.query.request === 'string'
          ? route.query.request
          : typeof route.query.order === 'string'
            ? route.query.order
            : typeof route.query.receipt === 'string'
              ? route.query.receipt
              : typeof route.query.supplier === 'string'
                ? route.query.supplier
                : undefined,
    },
    silent,
  )
}

const suppressBoardWatch = ref(false)

watch(
  [tab, filter, orderFilter, receiptFilter, supplierFilter, listPage],
  ([nextTab], [prevTab]) => {
    if (suppressBoardWatch.value) return
    if (nextTab !== prevTab) listPage.value = 1
    reloadBoard(true)
  },
)

watch(
  [selected, groupIds],
  ([overview, groups]) => {
    if (!overview) return
    const ids = groups.length ? groups : [overview.request.id]
    void loadSourcing(ids)
  },
  { deep: true },
)

watch(
  page,
  (value) => {
    if (value && value !== listPage.value) listPage.value = value
  },
)

const pageTitle = computed(() => {
  if (tab.value === 'orders') return 'Commandes'
  if (tab.value === 'receipts') return 'Réceptions'
  if (tab.value === 'suppliers') return 'Fournisseurs'
  return 'Demandes d’achat'
})

const pageDescription = computed(() => {
  if (tab.value === 'orders') return 'Suivre les OA, les retards, puis ouvrir la réception.'
  if (tab.value === 'receipts') return 'Contrôler les arrivages et clôturer les commandes.'
  if (tab.value === 'suppliers') return 'Fournisseurs utilisés pour passer commande.'
  return 'Valider, regrouper si besoin, commander, puis réceptionner.'
})

onMounted(() => {
  // Deep-link OA → BR : un reload « orders » concurrent écraserait la fiche réception.
  if (route.query.action === 'receive' && typeof route.query.order === 'string') {
    void loadBoard(
      {
        section: 'orders',
        filter: orderFilter.value,
        page: 1,
        pageSize: 8,
        focusId: route.query.order,
      },
      false,
    )
    return
  }
  reloadBoard(false)
})

function toneBar(overview: RequestOverview) {
  const status = overview.request.status === 'cancelled' ? 'rejected' : overview.request.status
  if (status === 'rejected') return 'border-l-red-500'
  if (status === 'expired') return 'border-l-muted-foreground/40'
  if (status === 'submitted' || status === 'in_review') return 'border-l-amber-500'
  if (status === 'approved' || status === 'ordered' || status === 'closed') return 'border-l-emerald-500'
  return 'border-l-border'
}

function defaultTab() {
  return currentUser.value?.role === 'WAREHOUSE_MANAGER' ? 'receipts' : 'requests'
}

function defaultFilter() {
  const role = currentUser.value?.role
  if (role === 'MANAGER') return 'submitted'
  if (role === 'PROCUREMENT' || role === 'WAREHOUSE_MANAGER') return 'approved'
  return 'all'
}

function priorityLabel(value: string) {
  if (value === 'high') return 'Haute'
  if (value === 'low') return 'Basse'
  return 'Moyenne'
}

function itemsSummary(overview: RequestOverview) {
  const names = overview.lines.map((line) => line.productName)
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' · ')
  return `${names.length} articles · ${names.slice(0, 2).join(', ')}…`
}

function orderItemsSummary(overview: OrderOverview) {
  const names = overview.lines.map((line) => line.productName)
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(' · ')
  return `${names.length} articles · ${names.slice(0, 2).join(', ')}…`
}

function orderToneBar(overview: OrderOverview) {
  if (overview.late || overview.order.status === 'cancelled') return 'border-l-red-500'
  if (overview.order.status === 'received') return 'border-l-emerald-500'
  if (overview.order.status === 'partial') return 'border-l-amber-500'
  return 'border-l-blue-500'
}

watch(overviews, (list) => {
  if (!selected.value) return
  selected.value = list.find((item) => item.request.id === selected.value?.request.id) ?? selected.value
})

watch(receiptOverviews, (list) => {
  if (!selectedReceipt.value) return
  selectedReceipt.value = list.find((item) => item.receipt.id === selectedReceipt.value?.receipt.id) ?? selectedReceipt.value
})

watch(orderOverviews, (list) => {
  if (!selectedOrder.value) return
  selectedOrder.value = list.find((item) => item.order.id === selectedOrder.value?.order.id) ?? selectedOrder.value
})

watch(
  () => [route.query.request, overviews.value] as const,
  () => {
    const id = route.query.request
    if (typeof id !== 'string' || !id) return
    const item = overviews.value.find((row) => row.request.id === id)
    if (item) selected.value = item
  },
)

const receiveHandledFor = ref<string | null>(null)

watch(
  () => [route.query.order, route.query.action, orderOverviews.value] as const,
  async () => {
    const id = route.query.order
    if (typeof id !== 'string' || !id) {
      receiveHandledFor.value = null
      return
    }
    const item = orderOverviews.value.find((row) => row.order.id === id)
    if (!item) return
    selectedOrder.value = item
    if (route.query.action === 'receive' && receiveHandledFor.value !== id) {
      receiveHandledFor.value = id
      const receiptId = item.linkedReceipt?.id
      if (receiptId) {
        // Chemin démo fiable : bascule URL → watch receipt ouvre la fiche.
        await router.replace({ path: '/procurement', query: { tab: 'receipts', receipt: receiptId } })
        return
      }
      await onOpenOrderReceipt()
    }
  },
)

watch(
  () => [route.query.receipt, receiptOverviews.value] as const,
  () => {
    const id = route.query.receipt
    if (typeof id !== 'string' || !id) return
    const item = receiptOverviews.value.find((row) => row.receipt.id === id)
    if (item) selectedReceipt.value = item
  },
)

async function addRequest(payload: {
  warehouseId: string
  items: { productId: string; quantity: number }[]
  note: string
  priority: RequestOverview['priority']
  asDraft: boolean
}) {
  await run(async () => {
    await createRequest(
      payload.warehouseId,
      payload.items,
      payload.note || 'Demande créée depuis l’écran Approvisionnement',
      { priority: payload.priority, status: payload.asDraft ? 'draft' : 'submitted' },
    )
    reqOpen.value = false
  })
}

async function onApprove() {
  if (!selected.value) return
  await run(async () => {
    await approveRequest(selected.value!.request.id)
    selected.value = null
  })
}

async function onTakeCharge() {
  if (!selected.value) return
  await run(async () => {
    const id = selected.value!.request.id
    await takeCharge(id)
    if (!groupIds.value.includes(id)) groupIds.value = [id]
  })
}

async function onIssue() {
  if (!selected.value) return
  await run(async () => {
    await issueFromRequest(selected.value!.request.id)
    selected.value = null
  })
}

function openRequest(item: RequestOverview) {
  if (!groupIds.value.includes(item.request.id)) groupIds.value = [item.request.id]
  selected.value = item
}

function toggleGroupId(id: string, warehouseId: string) {
  if (groupIds.value.includes(id)) {
    const next = groupIds.value.filter((item) => item !== id)
    groupIds.value = next.length ? next : selected.value ? [selected.value.request.id] : []
    return
  }
  const first = overviews.value.find((item) => item.request.id === groupIds.value[0])
  if (first && first.request.warehouseId !== warehouseId) {
    groupIds.value = [id]
    return
  }
  groupIds.value = [...groupIds.value, id]
}

async function onCreateOrder(supplierId: string) {
  const ids = groupIds.value.length ? groupIds.value : selected.value ? [selected.value.request.id] : []
  if (!ids.length) return
  await run(async () => {
    await createOrderFromOffer(ids, supplierId)
    groupIds.value = []
    selected.value = null
  })
}

async function onLaunchConsultation(payload: { supplierIds: string[]; note: string }) {
  const ids = groupIds.value.length ? groupIds.value : selected.value ? [selected.value.request.id] : []
  if (!ids.length) return
  await run(async () => {
    await launchConsultation(ids, payload.supplierIds, payload.note)
  })
}

async function onAwardQuote(quoteId: string) {
  const consultation = selected.value?.linkedConsultation
  if (!consultation) return
  await run(async () => {
    await awardQuote(consultation.id, quoteId)
    groupIds.value = []
    selected.value = null
  })
}

async function onCancelConsultation() {
  const consultation = selected.value?.linkedConsultation
  if (!consultation) return
  await run(async () => {
    await cancelConsultation(consultation.id)
    selected.value = null
  })
}

async function onAttachQuote(payload: { quoteId: string; file: QuoteFile }) {
  const consultation = selected.value?.linkedConsultation
  if (!consultation) return
  await run(async () => {
    await attachQuoteFile(consultation.id, payload.quoteId, payload.file)
  })
}

async function openReceiptById(id: string) {
  // Coupe le watch [tab, filters] le temps de basculer : sinon un reload
  // « orders » concurrent laisse l’onglet Réceptions avec un board commandes.
  suppressBoardWatch.value = true
  try {
    listPage.value = 1
    receiptFilter.value = 'pending'
    tab.value = 'receipts'
    await loadBoard(
      { section: 'receipts', filter: 'pending', page: 1, pageSize: 8, focusId: id },
      true,
    )
    selectedReceipt.value =
      receiptOverviews.value.find((item) => item.receipt.id === id) ??
      receiptOverviews.value.find((item) => item.receipt.purchaseOrderId === id) ??
      null
    // Aligne l’URL pour que l’état (tab + fiche) survive aux reloads concurrent.
    if (route.query.tab !== 'receipts' || route.query.receipt !== id) {
      await router.replace({ path: '/procurement', query: { tab: 'receipts', receipt: id } })
    }
  } finally {
    suppressBoardWatch.value = false
  }
}

async function onOpenReceipt() {
  if (!selected.value?.linkedReceipt) return
  const id = selected.value.linkedReceipt.id
  selected.value = null
  await openReceiptById(id)
}

async function onOpenOrderReceipt() {
  if (!selectedOrder.value) return
  await run(async () => {
    if (!selectedOrder.value!.linkedReceipt) {
      await ensureOrderReceipt(selectedOrder.value!.order.id)
    }
    const id = selectedOrder.value!.linkedReceipt?.id
      ?? receiptOverviews.value.find((item) => item.receipt.purchaseOrderId === selectedOrder.value?.order.id)?.receipt.id
    if (!id) return
    selectedOrder.value = null
    await openReceiptById(id)
  })
}

async function onConfirmOrder() {
  if (!selectedOrder.value) return
  await run(async () => {
    await confirmOrder(selectedOrder.value!.order.id)
    selectedOrder.value = null
  })
}

function openRequestFromOrder(id: string) {
  const request = overviews.value.find((item) => item.request.id === id)
  if (!request) return
  selectedOrder.value = null
  tab.value = 'requests'
  openRequest(request)
}

async function onValidateReceipt(lines: { productId: string; received: number }[]) {
  if (!selectedReceipt.value) return
  await run(async () => {
    await validateReceipt(selectedReceipt.value!.receipt.id, lines)
    selectedReceipt.value = null
  })
}

async function onReject() {
  if (!selected.value) return
  await run(async () => {
    await rejectRequest(selected.value!.request.id)
    selected.value = null
  })
}

async function onChanges() {
  if (!selected.value) return
  await run(async () => {
    await requestChanges(selected.value!.request.id)
    selected.value = null
  })
}

function openNewSupplier() {
  editingSupplier.value = null
  supOpen.value = true
}

function openSupplier(supplier: Supplier) {
  editingSupplier.value = supplier
  supOpen.value = true
}

async function saveSupplier(payload: { id?: string; input: SupplierInput }) {
  await run(async () => {
    if (payload.id) await updateSupplier(payload.id, payload.input)
    else await createSupplier(payload.input)
    supOpen.value = false
    editingSupplier.value = null
    if (tab.value === 'suppliers') reloadBoard(true)
  })
}
</script>

<template>
  <div class="page-wide">
    <PageHeader :title="pageTitle" :description="pageDescription">
      <template #actions>
        <div class="flex gap-2">
          <Button v-if="can('procurement.create')" size="sm" @click="reqOpen = true">Nouvelle demande</Button>
          <Button v-if="can('product.create') && tab === 'suppliers'" size="sm" variant="outline" @click="openNewSupplier">
            Fournisseur
          </Button>
        </div>
      </template>
    </PageHeader>
    <Tabs v-model="tab" :tabs="tabs" class="mb-6" />
    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />

    <template v-else-if="tab === 'requests'">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="chip in chips"
          :key="chip.id"
          class="chip"
          :class="filter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="filter = chip.id; listPage = 1"
        >
          {{ chip.label }} {{ chip.count }}
        </button>
      </div>
      <p v-if="groupIds.length > 1" class="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        {{ groupIds.length }} demandes du même entrepôt seront regroupées dans un seul OA.
      </p>
      <EmptyState v-if="!filtered.length" title="Aucune demande dans ce filtre." />
      <div v-else class="space-y-2">
        <div
          v-for="item in filtered"
          :key="item.request.id"
          class="surface flex w-full items-start gap-3 border-l-4 px-4 py-3.5 hover:bg-muted/40"
          :class="toneBar(item)"
        >
          <input
            v-if="isReadyToPurchase(item)"
            type="checkbox"
            class="mt-1 size-4 shrink-0 rounded border-input"
            :checked="groupIds.includes(item.request.id)"
            @click.stop
            @change="toggleGroupId(item.request.id, item.request.warehouseId)"
          />
          <button class="min-w-0 flex-1 text-left" @click="openRequest(item)">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium">{{ item.code }}</p>
              <RequestStatusBadge :status="item.request.status" />
              <Badge v-if="item.linkedConsultation?.status === 'quoted' && !item.linkedOrder" variant="onorder">
                Devis reçus
              </Badge>
              <Badge :variant="item.priority === 'high' ? 'critical' : item.priority === 'low' ? 'info' : 'warning'">
                {{ priorityLabel(item.priority) }}
              </Badge>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">{{ itemsSummary(item) }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ item.request.note }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ item.requesterName }} · {{ item.service }} · {{ formatDateTime(item.request.createdAt) }}
              <span v-if="item.assigneeName"> · {{ item.assigneeName }}</span>
            </p>
          </button>
          <div class="shrink-0 text-right">
            <p class="text-sm font-semibold">{{ formatMoney(item.total) }}</p>
            <p class="text-xs text-muted-foreground">
              {{ item.decision === 'issue' ? 'Stock OK' : item.decision === 'purchase' ? 'À commander' : 'Mixte' }}
              <template v-if="item.nextOwner"> · {{ item.nextOwner }}</template>
            </p>
          </div>
        </div>
      </div>
      <div v-if="pages > 1" class="mt-3 flex items-center justify-between text-[13px]">
        <p class="text-muted-foreground">{{ total }} demandes</p>
        <div class="flex gap-1.5">
          <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
          <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
          <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
        </div>
      </div>
    </template>

    <div v-else-if="tab === 'orders'">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="chip in orderChips"
          :key="chip.id"
          class="chip"
          :class="orderFilter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="orderFilter = chip.id; listPage = 1"
        >
          {{ chip.label }} {{ chip.count }}
        </button>
      </div>
      <EmptyState v-if="!filteredOrders.length" title="Aucune commande dans ce filtre." />
      <div v-else class="space-y-2">
        <button
          v-for="item in filteredOrders"
          :key="item.order.id"
          class="surface flex w-full items-start justify-between border-l-4 px-4 py-3.5 text-left hover:bg-muted/40"
          :class="orderToneBar(item)"
          @click="selectedOrder = item"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium">{{ item.code }}</p>
              <OrderStatusBadge :status="item.order.status" :late="item.late" />
              <Badge v-if="item.requests.length > 1" variant="info">{{ item.requests.length }} DA</Badge>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">{{ orderItemsSummary(item) }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ item.supplierName }} · {{ item.warehouseName }}
              <span v-if="item.requests.length"> · {{ item.requests.map((request) => request.code).join(' · ') }}</span>
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-sm font-semibold">{{ formatMoney(item.order.amount) }}</p>
            <p class="text-xs text-muted-foreground">{{ (item as OrderOverview & { etaLabel?: string }).etaLabel ?? orderEtaLabel(item.order, item.late) }}</p>
          </div>
        </button>
      </div>
      <div v-if="pages > 1" class="mt-3 flex items-center justify-between text-[13px]">
        <p class="text-muted-foreground">{{ total }} commandes</p>
        <div class="flex gap-1.5">
          <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
          <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
          <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
        </div>
      </div>
    </div>
    <div v-else-if="tab === 'receipts'">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="chip in receiptChips"
          :key="chip.id"
          class="chip"
          :class="receiptFilter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="receiptFilter = chip.id; listPage = 1"
        >
          {{ chip.label }} {{ chip.count }}
        </button>
      </div>
      <EmptyState v-if="!filteredReceipts.length" title="Aucune réception dans ce filtre." />
      <div v-else class="space-y-2">
        <button
          v-for="item in filteredReceipts"
          :key="item.receipt.id"
          class="surface flex w-full items-start justify-between border-l-4 px-4 py-3.5 text-left hover:bg-muted/40"
          :class="item.receipt.status === 'validated' ? 'border-l-emerald-500' : item.receipt.status === 'partial' ? 'border-l-amber-500' : 'border-l-blue-500'"
          @click="selectedReceipt = item"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium">{{ item.code }}</p>
              <Badge :variant="item.receipt.status === 'validated' ? 'success' : item.receipt.status === 'partial' ? 'warning' : 'onorder'">
                {{ RECEIPT_LABEL[item.receipt.status] }}
              </Badge>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">{{ item.supplierName }} · {{ item.warehouseName }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ item.orderCode }}
              <span v-if="item.requestCode"> · {{ item.requestCode }}</span>
              · {{ formatDate(item.expectedDate) }}
            </p>
          </div>
          <p class="text-sm font-semibold">{{ item.receipt.received }}/{{ item.receipt.expected }}</p>
        </button>
      </div>
      <div v-if="pages > 1" class="mt-3 flex items-center justify-between text-[13px]">
        <p class="text-muted-foreground">{{ total }} réceptions</p>
        <div class="flex gap-1.5">
          <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
          <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
          <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
        </div>
      </div>
    </div>
    <div v-else class="space-y-2">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="chip in supplierChips"
          :key="chip.id"
          class="chip"
          :class="supplierFilter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="supplierFilter = chip.id; listPage = 1"
        >
          {{ chip.label }}
          <span class="tabular-nums opacity-70">{{ chip.count }}</span>
        </button>
      </div>
      <EmptyState v-if="!supplierRows.length" title="Aucun fournisseur." />
      <button
        v-for="supplier in supplierRows"
        :key="supplier.id"
        class="surface flex w-full items-start justify-between border-l-4 px-4 py-3.5 text-left hover:bg-muted/40"
        :class="supplier.status === 'active' ? 'border-l-emerald-500' : 'border-l-amber-500'"
        @click="openSupplier(supplier)"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium">{{ supplier.name }}</p>
            <Badge :variant="supplier.status === 'active' ? 'success' : 'warning'">
              {{ supplier.status === 'active' ? 'Actif' : 'En attente' }}
            </Badge>
            <Badge v-if="supplier.category" variant="outline">{{ supplier.category }}</Badge>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ supplier.contact }} · {{ supplier.city }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ supplier.email }} · {{ supplier.phone }}
            <template v-if="supplier.paymentTerms"> · {{ supplier.paymentTerms }}</template>
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-semibold">{{ supplier.reliability }}%</p>
          <p class="text-xs text-muted-foreground">Délai {{ supplier.leadTimeDays }} j</p>
        </div>
      </button>
      <div v-if="pages > 1" class="mt-3 flex items-center justify-between text-[13px]">
        <p class="text-muted-foreground">{{ total }} fournisseurs</p>
        <div class="flex gap-1.5">
          <Button size="sm" variant="outline" :disabled="listPage <= 1" @click="listPage -= 1">Précédent</Button>
          <span class="px-2 py-1 tabular-nums text-muted-foreground">{{ page }}/{{ pages }}</span>
          <Button size="sm" variant="outline" :disabled="listPage >= pages" @click="listPage += 1">Suivant</Button>
        </div>
      </div>
    </div>

    <RequestDetailSheet
      :open="!!selected"
      :overview="selected"
      :offers="sourcingOffers"
      :groupable="selected ? groupableWith(selected.request.id) : []"
      :group-ids="groupIds"
      :suppliers="suppliers"
      @close="selected = null"
      @approve="onApprove"
      @reject="onReject"
      @changes="onChanges"
      @take-charge="onTakeCharge"
      @issue="onIssue"
      @order="onCreateOrder"
      @receive="onOpenReceipt"
      @toggle-group="toggleGroupId($event, selected?.request.warehouseId ?? '')"
      @launch-consultation="onLaunchConsultation"
      @award-quote="onAwardQuote"
      @cancel-consultation="onCancelConsultation"
      @attach-quote="onAttachQuote"
    />
    <ReceiptDetailSheet
      :open="!!selectedReceipt"
      :overview="selectedReceipt"
      :can-receive="can('stock.receive')"
      @close="selectedReceipt = null"
      @validate="onValidateReceipt"
    />
    <OrderDetailSheet
      :open="!!selectedOrder"
      :overview="selectedOrder"
      @close="selectedOrder = null"
      @confirm="onConfirmOrder"
      @receive="onOpenOrderReceipt"
      @open-request="openRequestFromOrder"
    />

    <RequestFormSheet
      :open="reqOpen"
      :products="products"
      :warehouses="warehouses"
      @close="reqOpen = false"
      @submit="addRequest"
    />
    <SupplierFormSheet
      :open="supOpen"
      :supplier="editingSupplier"
      @close="supOpen = false; editingSupplier = null"
      @submit="saveSupplier"
    />
  </div>
</template>
