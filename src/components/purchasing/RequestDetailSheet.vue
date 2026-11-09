<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Tabs from '@/components/ui/Tabs.vue'
import RequestStatusBadge from '@/components/purchasing/RequestStatusBadge.vue'
import { formatDateTime, formatMoney, formatNumber } from '@/lib/utils'
import { usePermissions } from '@/composables/usePermissions'
import { useCurrentUser } from '@/composables/useAuth'
import { normalizeStatus } from '@/services/request.overview'
import type { RequestOverview } from '@/services/request.overview'
import type { SourcingOffer } from '@/services/sourcing.service'
import type { QuoteFile, Supplier } from '@/types'
import SourcingOffers from '@/components/purchasing/SourcingOffers.vue'
import ConsultationPanel from '@/components/purchasing/ConsultationPanel.vue'
import OfficialDocument from '@/components/documents/OfficialDocument.vue'
import DocumentShareBar from '@/components/documents/DocumentShareBar.vue'
import { useIssuer } from '@/composables/useIssuer'
import { documentWhatsAppMessage } from '@/utils/documents'

const props = defineProps<{
  open: boolean
  overview: RequestOverview | null
  offers?: SourcingOffer[]
  groupable?: RequestOverview[]
  groupIds?: string[]
  suppliers?: Supplier[]
}>()
const emit = defineEmits<{
  close: []
  approve: []
  reject: []
  changes: []
  takeCharge: []
  issue: []
  order: [supplierId: string]
  receive: []
  toggleGroup: [id: string]
  launchConsultation: [payload: { supplierIds: string[]; note: string }]
  awardQuote: [quoteId: string]
  cancelConsultation: []
  attachQuote: [payload: { quoteId: string; file: QuoteFile }]
}>()
const { can } = usePermissions()
const { currentUser } = useCurrentUser()
const { issuer } = useIssuer()

const priorityLabel: Record<string, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
}

const status = computed(() => (props.overview ? normalizeStatus(props.overview.request.status) : ''))
const mine = computed(() => currentUser.value?.id === props.overview?.request.assigneeId)

const canApprove = computed(
  () => can('procurement.approve') && ['submitted', 'in_review'].includes(status.value),
)
const canTakeCharge = computed(
  () =>
    can('purchase.create') &&
    status.value === 'approved' &&
    props.overview?.request.assignedRole === 'PROCUREMENT' &&
    !props.overview.request.takenAt &&
    mine.value,
)
const canIssue = computed(
  () =>
    can('stock.issue') &&
    status.value === 'approved' &&
    props.overview?.request.assignedRole === 'WAREHOUSE_MANAGER' &&
    mine.value,
)
const canOrder = computed(
  () =>
    can('purchase.create') &&
    status.value === 'approved' &&
    Boolean(props.overview?.request.takenAt) &&
    props.overview?.request.assignedRole === 'PROCUREMENT' &&
    mine.value &&
    !props.overview.linkedOrder,
)
const showSourcing = computed(
  () =>
    Boolean(props.overview?.request.takenAt) &&
    props.overview?.decision !== 'issue' &&
    status.value !== 'rejected',
)
const canReceive = computed(
  () =>
    can('stock.receive') &&
    Boolean(props.overview?.linkedReceipt) &&
    props.overview?.linkedReceipt?.status !== 'validated',
)

const showGrouping = computed(() => canOrder.value && Boolean(props.groupable?.length))
const hasActions = computed(
  () => canApprove.value || canTakeCharge.value || canIssue.value || canReceive.value,
)

const daLines = computed(() =>
  (props.overview?.lines ?? []).map((line) => ({
    name: line.productName,
    sku: line.sku,
    qty: `${formatNumber(line.quantity)} ${line.unit}`,
    detail: formatMoney(line.amount),
  })),
)

const daMessage = computed(() => {
  const item = props.overview
  if (!item) return ''
  return documentWhatsAppMessage({
    title: 'Demande d’achat',
    code: item.code,
    issuer: issuer.value.name,
    lines: [
      `Site : ${item.warehouseName}`,
      `Demandeur : ${item.requesterName}`,
      ...item.lines.map((line) => `• ${line.productName} × ${line.quantity} ${line.unit}`),
      `Total estimé : ${formatMoney(item.total)}`,
    ],
  })
})

const tab = ref('summary')
const tabs = computed(() => {
  const list = [
    { id: 'summary', label: 'Résumé' },
    { id: 'items', label: `Articles (${props.overview?.lines.length ?? 0})` },
  ]
  if (showSourcing.value) {
    list.push({ id: 'reference', label: 'Référence' })
    const quoted = props.overview?.linkedConsultation?.status === 'quoted'
    list.push({ id: 'quotes', label: quoted ? 'Devis' : 'Consultation' })
  } else if (showGrouping.value) {
    list.push({ id: 'reference', label: 'Achats' })
  }
  list.push({ id: 'track', label: 'Suivi' })
  return list
})

watch(
  () => [props.open, props.overview?.request.id] as const,
  ([open]) => {
    if (!open) return
    tab.value = defaultBuyTab()
    if (!tabs.value.some((item) => item.id === tab.value)) tab.value = 'summary'
  },
)

watch(canOrder, (ready, was) => {
  if (ready && !was) tab.value = defaultBuyTab()
})

watch(
  () => props.overview?.linkedConsultation?.id,
  (id, previous) => {
    if (id && id !== previous) tab.value = 'quotes'
  },
)

function defaultBuyTab() {
  const quoted = props.overview?.linkedConsultation?.status === 'quoted' && !props.overview.linkedOrder
  if (quoted) return 'quotes'
  if (canOrder.value || showSourcing.value || showGrouping.value) return 'reference'
  return 'summary'
}

function stepClass(state: string) {
  if (state === 'done') return 'border-primary bg-primary'
  if (state === 'current') return 'border-amber-500 bg-amber-500'
  if (state === 'skipped') return 'border-border bg-muted'
  return 'border-border bg-card'
}

function ownerLabel(overview: RequestOverview) {
  if (!overview.assigneeName && !overview.nextOwner) return ''
  const role = overview.nextOwner || (overview.request.assignedRole === 'WAREHOUSE_MANAGER' ? 'Magasin' : 'Achats')
  return overview.assigneeName ? `${overview.assigneeName} · ${role}` : role
}
</script>

<template>
  <Sheet :open="open && !!overview" :title="overview?.code" wide @close="emit('close')">
    <div v-if="overview" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <RequestStatusBadge :status="overview.request.status" />
        <Badge :variant="overview.priority === 'high' ? 'critical' : overview.priority === 'medium' ? 'warning' : 'info'">
          Priorité {{ priorityLabel[overview.priority] }}
        </Badge>
        <Badge v-if="overview.linkedConsultation?.status === 'quoted' && !overview.linkedOrder" variant="onorder">
          Devis reçus
        </Badge>
      </div>
      <p class="text-sm text-muted-foreground">{{ overview.request.note }}</p>

      <Tabs v-model="tab" :tabs="tabs" />

      <div v-if="tab === 'summary'" class="space-y-4">
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">Demandeur</dt>
            <dd class="mt-0.5 font-medium">{{ overview.requesterName }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Service</dt>
            <dd class="mt-0.5 font-medium">{{ overview.service }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Entrepôt</dt>
            <dd class="mt-0.5 font-medium">{{ overview.warehouseName }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Date</dt>
            <dd class="mt-0.5 font-medium">{{ formatDateTime(overview.request.createdAt) }}</dd>
          </div>
        </dl>
        <p v-if="overview.request.decisionNote" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ overview.request.decisionNote }}
        </p>
        <section class="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p class="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles class="size-4" />
            Décision stock
          </p>
          <p class="mt-2 text-sm">
            <template v-if="overview.decision === 'issue'">
              Stock disponible suffisant — une sortie de stock peut suffire.
            </template>
            <template v-else-if="overview.decision === 'purchase'">
              Stock insuffisant — un approvisionnement est nécessaire.
            </template>
            <template v-else>
              Couverture partielle — sortie possible sur une partie, le reste à commander.
            </template>
          </p>
          <p v-if="ownerLabel(overview)" class="mt-3 text-sm font-medium">
            {{ status === 'approved' || status === 'ordered' || status === 'closed' ? 'En main' : 'Prochaine main' }}
            : {{ ownerLabel(overview) }}
          </p>
          <p v-if="overview.request.takenAt" class="mt-1 text-xs text-muted-foreground">
            Prise en charge le {{ formatDateTime(overview.request.takenAt) }}
          </p>
        </section>
        <p class="text-xs text-muted-foreground">
          {{ overview.lines.length }} article{{ overview.lines.length > 1 ? 's' : '' }}
          · {{ formatMoney(overview.total) }}
        </p>
        <OfficialDocument
          title="Demande d’achat"
          :code="overview.code"
          :date="overview.request.createdAt"
          :issuer-name="issuer.name"
          :issuer-legal="issuer.legalName"
          :issuer-ice="issuer.ice"
          :issuer-city="issuer.city"
          :issuer-phone="issuer.phone"
          :issuer-email="issuer.email"
          :parties="[
            { title: 'Demandeur', name: overview.requesterName, detail: overview.service },
            { title: 'Entrepôt', name: overview.warehouseName },
          ]"
          :lines="daLines"
          :total-label="`Total estimé ${formatMoney(overview.total)}`"
          :notes="overview.request.note"
          :signatures="[
            { label: 'Demandeur', name: overview.requesterName },
            { label: 'Validation' },
          ]"
        />
      </div>

      <div v-else-if="tab === 'items'" class="space-y-3">
        <article v-for="line in overview.lines" :key="line.productId" class="rounded-xl border px-3 py-2.5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium">{{ line.productName }}</p>
              <p class="text-xs text-muted-foreground">{{ line.sku }} · {{ formatNumber(line.quantity) }} {{ line.unit }}s</p>
            </div>
            <p class="text-sm font-semibold">{{ formatMoney(line.amount) }}</p>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            Dispo. {{ formatNumber(line.available) }} · estimé {{ formatMoney(line.unitPrice) }} / {{ line.unit }}
          </p>
        </article>
        <p class="text-right text-sm font-semibold">Total estimé {{ formatMoney(overview.total) }}</p>
      </div>

      <div v-else-if="tab === 'reference'" class="space-y-4">
        <p class="text-xs text-muted-foreground">
          Classement interne à partir du catalogue. Pour des prix négociés, ouvrez l’onglet Consultation.
        </p>
        <section v-if="showGrouping" class="rounded-xl border px-3 py-3">
          <p class="text-sm font-semibold">Regrouper dans le même OA</p>
          <p class="mt-1 text-xs text-muted-foreground">Même entrepôt uniquement. Les quantités d’un même article sont fusionnées.</p>
          <label
            v-for="item in groupable"
            :key="item.request.id"
            class="mt-2 flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-muted/50"
          >
            <input
              type="checkbox"
              class="mt-1 size-4 rounded border-input"
              :checked="groupIds?.includes(item.request.id)"
              @change="emit('toggleGroup', item.request.id)"
            />
            <span>
              <span class="text-sm font-medium">{{ item.code }}</span>
              <span class="block text-xs text-muted-foreground">
                {{ item.lines.length }} article{{ item.lines.length > 1 ? 's' : '' }}
                · {{ item.request.note }}
              </span>
            </span>
          </label>
        </section>
        <SourcingOffers
          v-if="showSourcing"
          :offers="offers ?? []"
          :can-order="canOrder"
          :chosen-id="overview.linkedOrder?.supplierId"
          :order-count="Math.max(1, groupIds?.length ?? 1)"
          @order="emit('order', $event)"
        />
      </div>

      <div v-else-if="tab === 'quotes'" class="space-y-4">
        <ConsultationPanel
          :consultation="overview.linkedConsultation"
          :offers="offers ?? []"
          :suppliers="suppliers ?? []"
          :can-act="canOrder"
          @launch="emit('launchConsultation', $event)"
          @award="emit('awardQuote', $event)"
          @cancel="emit('cancelConsultation')"
          @attach="emit('attachQuote', $event)"
        />
      </div>

      <div v-else class="space-y-4">
        <section>
          <h3 class="text-sm font-semibold">Parcours</h3>
          <ol class="relative ml-2 mt-3 border-l border-border">
            <li v-for="step in overview.timeline" :key="step.id" class="relative pb-4 pl-5 last:pb-0">
              <span class="absolute -left-1.5 top-1 size-3 rounded-full border-2" :class="stepClass(step.state)" />
              <p class="text-sm font-medium" :class="step.state === 'skipped' ? 'text-muted-foreground line-through' : ''">
                {{ step.label }}
              </p>
              <p v-if="step.date || step.detail" class="text-xs text-muted-foreground">
                {{ step.detail }} <span v-if="step.date">{{ formatDateTime(step.date) }}</span>
              </p>
            </li>
          </ol>
        </section>
        <section v-if="overview.linkedOrder || overview.linkedReceipt || overview.linkedConsultation">
          <h3 class="text-sm font-semibold">Documents liés</h3>
          <p class="mt-2 text-sm text-muted-foreground">
            {{ overview.code }}
            <span v-if="overview.linkedConsultation"> → {{ overview.linkedConsultation.code ?? overview.linkedConsultation.id.toUpperCase() }}</span>
            <span v-if="overview.linkedOrder"> → {{ overview.linkedOrder.code ?? overview.linkedOrder.id.toUpperCase() }}</span>
            <span v-if="overview.linkedReceipt"> → {{ overview.linkedReceipt.code ?? overview.linkedReceipt.id.toUpperCase() }}</span>
          </p>
          <p v-if="(overview.linkedOrder?.procurementRequestIds?.length ?? 0) > 1" class="mt-1 text-xs text-muted-foreground">
            OA groupé · {{ overview.linkedOrder?.procurementRequestIds?.length }} demandes
          </p>
        </section>
      </div>
    </div>
    <template #footer>
      <div class="space-y-3">
        <DocumentShareBar
          :filename="overview?.code ?? 'DA'"
          :message="daMessage"
        />
        <div v-if="canApprove" class="flex flex-col gap-2">
          <Button @click="emit('approve')">Valider</Button>
          <Button variant="outline" @click="emit('changes')">Demander une modification</Button>
          <Button variant="destructive" @click="emit('reject')">Rejeter</Button>
        </div>
        <div v-else-if="canTakeCharge" class="flex flex-col gap-2">
          <Button @click="emit('takeCharge')">Prendre en charge</Button>
        </div>
        <div v-else-if="canIssue" class="flex flex-col gap-2">
          <Button @click="emit('issue')">Sortir du stock</Button>
        </div>
        <div v-else-if="canReceive" class="flex flex-col gap-2">
          <Button @click="emit('receive')">Ouvrir la réception</Button>
        </div>
      </div>
    </template>
  </Sheet>
</template>
