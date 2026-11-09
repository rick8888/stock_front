<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProcurement } from '@/composables/useProcurement'
import { useSuppliers } from '@/composables/useSuppliers'
import { useProducts } from '@/composables/useProducts'
import { useWarehouses } from '@/composables/useWarehouses'
import { usePermissions } from '@/composables/usePermissions'
import { useCurrentUser } from '@/composables/useAuth'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import RequestStatusBadge from '@/components/purchasing/RequestStatusBadge.vue'
import RequestDetailSheet from '@/components/purchasing/RequestDetailSheet.vue'
import RequestFormSheet from '@/components/purchasing/RequestFormSheet.vue'
import SupplierFormSheet from '@/components/purchasing/SupplierFormSheet.vue'
import ReceiptDetailSheet from '@/components/purchasing/ReceiptDetailSheet.vue'
import OrderDetailSheet from '@/components/purchasing/OrderDetailSheet.vue'
import OrderStatusBadge from '@/components/purchasing/OrderStatusBadge.vue'
import { formatMoney, formatDateTime, formatDate } from '@/lib/utils'
import { normalizeStatus } from '@/services/request.overview'
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
  counts,
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
  sourcingFor,
  groupableWith,
  isReadyToPurchase,
  rejectRequest,
  requestChanges,
  loading,
} = useProcurement()
const { suppliers, createSupplier, updateSupplier } = useSuppliers()
const { products } = useProducts()
const { warehouses } = useWarehouses()
const route = useRoute()

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

const filter = ref<'all' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'ordered'>(defaultFilter())
const selected = ref<RequestOverview | null>(null)
const groupIds = ref<string[]>([])
const selectedReceipt = ref<ReceiptOverview | null>(null)
const selectedOrder = ref<OrderOverview | null>(null)
const receiptFilter = ref<'all' | 'pending' | 'partial' | 'validated'>('pending')
const orderFilter = ref<'open' | 'delayed' | 'received' | 'all'>('open')
const reqOpen = ref(false)
const supOpen = ref(false)
const editingSupplier = ref<Supplier | null>(null)

const filtered = computed(() =>
  overviews.value.filter((item) => {
    if (filter.value === 'all') return true
    const status = normalizeStatus(item.request.status)
    if (filter.value === 'ordered') return status === 'ordered' || status === 'closed'
    if (filter.value === 'submitted') return status === 'submitted'
    return status === filter.value
  }),
)

const receiptChips = computed(() => {
  const list = receiptOverviews.value
  return [
    { id: 'pending' as const, label: 'À faire', count: list.filter((item) => item.receipt.status === 'pending' || item.receipt.status === 'checking').length },
    { id: 'partial' as const, label: 'Écarts', count: list.filter((item) => item.receipt.status === 'partial').length },
    { id: 'validated' as const, label: 'Validées', count: list.filter((item) => item.receipt.status === 'validated').length },
    { id: 'all' as const, label: 'Toutes', count: list.length },
  ]
})

const filteredReceipts = computed(() =>
  receiptOverviews.value.filter((item) => {
    if (receiptFilter.value === 'all') return true
    if (receiptFilter.value === 'pending') return item.receipt.status === 'pending' || item.receipt.status === 'checking'
    return item.receipt.status === receiptFilter.value
  }),
)

const chips = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: counts.value.all },
  { id: 'submitted' as const, label: 'À valider', count: counts.value.submitted },
  { id: 'in_review' as const, label: 'En validation', count: counts.value.in_review },
  { id: 'approved' as const, label: 'Validées / à traiter', count: counts.value.approved },
  { id: 'rejected' as const, label: 'Rejetées', count: counts.value.rejected },
  { id: 'ordered' as const, label: 'Traitées', count: counts.value.ordered },
])

const orderChips = computed(() => {
  const list = orderOverviews.value
  return [
    { id: 'open' as const, label: 'En cours', count: list.filter((item) => !['received', 'cancelled'].includes(item.order.status)).length },
    { id: 'delayed' as const, label: 'En retard', count: list.filter((item) => item.late).length },
    { id: 'received' as const, label: 'Reçues', count: list.filter((item) => item.order.status === 'received').length },
    { id: 'all' as const, label: 'Toutes', count: list.length },
  ]
})

const filteredOrders = computed(() =>
  orderOverviews.value.filter((item) => {
    if (orderFilter.value === 'all') return true
    if (orderFilter.value === 'delayed') return item.late
    if (orderFilter.value === 'received') return item.order.status === 'received'
    return !['received', 'cancelled'].includes(item.order.status)
  }),
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

function toneBar(overview: RequestOverview) {
  const status = normalizeStatus(overview.request.status)
  if (status === 'rejected') return 'border-l-red-500'
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

watch(
  () => [route.query.order, orderOverviews.value] as const,
  () => {
    const id = route.query.order
    if (typeof id !== 'string' || !id) return
    const item = orderOverviews.value.find((row) => row.order.id === id)
    if (item) selectedOrder.value = item
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

async function onOpenReceipt() {
  if (!selected.value?.linkedReceipt) return
  const id = selected.value.linkedReceipt.id
  selected.value = null
  tab.value = 'receipts'
  selectedReceipt.value = receiptOverviews.value.find((item) => item.receipt.id === id) ?? null
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
    tab.value = 'receipts'
    selectedReceipt.value = receiptOverviews.value.find((item) => item.receipt.id === id) ?? null
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

    <template v-else-if="tab === 'requests'">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="chip in chips"
          :key="chip.id"
          class="chip"
          :class="filter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="filter = chip.id"
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
    </template>

    <div v-else-if="tab === 'orders'">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="chip in orderChips"
          :key="chip.id"
          class="chip"
          :class="orderFilter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="orderFilter = chip.id"
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
            <p class="text-xs text-muted-foreground">{{ orderEtaLabel(item.order, item.late) }}</p>
          </div>
        </button>
      </div>
    </div>
    <div v-else-if="tab === 'receipts'">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="chip in receiptChips"
          :key="chip.id"
          class="chip"
          :class="receiptFilter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="receiptFilter = chip.id"
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
    </div>
    <div v-else class="space-y-2">
      <EmptyState v-if="!suppliers.length" title="Aucun fournisseur." />
      <button
        v-for="supplier in suppliers"
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
    </div>

    <RequestDetailSheet
      :open="!!selected"
      :overview="selected"
      :offers="selected ? sourcingFor(groupIds.length ? groupIds : [selected.request.id]) : []"
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
