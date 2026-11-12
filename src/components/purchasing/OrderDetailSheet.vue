<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageCircle } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import OrderStatusBadge from '@/components/purchasing/OrderStatusBadge.vue'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/utils'
import { usePermissions } from '@/composables/usePermissions'
import { orderEtaLabel } from '@/services/order.overview'
import type { OrderOverview } from '@/services/order.overview'
import OfficialDocument from '@/components/documents/OfficialDocument.vue'
import DocumentShareBar from '@/components/documents/DocumentShareBar.vue'
import WhatsAppShareSheet from '@/components/documents/WhatsAppShareSheet.vue'
import { useIssuer } from '@/composables/useIssuer'
import { documentWhatsAppMessage } from '@/utils/documents'

const props = defineProps<{ open: boolean; overview: OrderOverview | null }>()
const emit = defineEmits<{
  close: []
  confirm: []
  receive: []
  openRequest: [id: string]
}>()
const { can } = usePermissions()
const { issuer } = useIssuer()
const chaseOpen = ref(false)

const canConfirm = computed(
  () => can('purchase.create') && props.overview?.order.status === 'sent',
)
const canReceive = computed(
  () =>
    can('stock.receive') &&
    Boolean(props.overview) &&
    ['sent', 'confirmed', 'partial', 'delayed'].includes(props.overview!.order.status) &&
    props.overview?.linkedReceipt?.status !== 'validated',
)
const canChase = computed(
  () =>
    Boolean(props.overview?.late || props.overview?.order.status === 'delayed') &&
    Boolean(props.overview?.supplierPhone) &&
    can('purchase.view'),
)

function stepClass(state: string) {
  if (state === 'done') return 'border-primary bg-primary'
  if (state === 'current') return 'border-amber-500 bg-amber-500'
  if (state === 'skipped') return 'border-border bg-muted'
  return 'border-border bg-card'
}

const oaLines = computed(() =>
  (props.overview?.lines ?? []).map((line) => ({
    name: line.productName,
    sku: line.sku,
    qty: `${formatNumber(line.quantity)} ${line.unit}`,
    detail: formatMoney(line.amount),
  })),
)

const oaContacts = computed(() => {
  const phone = props.overview?.supplierPhone
  if (!phone) return []
  return [{ label: props.overview!.supplierName, phone, hint: 'Fournisseur' }]
})

const oaMessage = computed(() => {
  const item = props.overview
  if (!item) return ''
  return documentWhatsAppMessage({
    title: 'Ordre d’achat',
    code: item.code,
    issuer: issuer.value.name,
    lines: [
      `Fournisseur : ${item.supplierName}`,
      `Entrepôt : ${item.warehouseName}`,
      `Livraison prévue : ${formatDate(item.order.expectedDate)}`,
      ...item.lines.map((line) => `• ${line.productName} × ${line.quantity} ${line.unit}`),
      `Total : ${formatMoney(item.order.amount)}`,
    ],
  })
})

const chaseMessage = computed(() => {
  const item = props.overview
  if (!item) return ''
  return documentWhatsAppMessage({
    title: 'Relance livraison',
    code: item.code,
    issuer: issuer.value.name,
    lines: [
      `Bonjour ${item.supplierName},`,
      `Nous relançons la commande ${item.code} prévue le ${formatDate(item.order.expectedDate)}.`,
      ...item.lines.map((line) => `• ${line.productName} × ${line.quantity} ${line.unit}`),
      `Merci de confirmer la date de livraison à ${item.warehouseName}.`,
    ],
  })
})
</script>

<template>
  <Sheet :open="open && !!overview" :title="overview?.code" wide @close="emit('close')">
    <div v-if="overview" class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <OrderStatusBadge :status="overview.order.status" :late="overview.late" />
        <Badge v-if="overview.requests.length > 1" variant="info">{{ overview.requests.length }} DA</Badge>
      </div>

      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt class="text-xs text-muted-foreground">Fournisseur</dt>
          <dd class="mt-0.5 font-medium">{{ overview.supplierName }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Entrepôt</dt>
          <dd class="mt-0.5 font-medium">{{ overview.warehouseName }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Créée</dt>
          <dd class="mt-0.5 font-medium">{{ formatDateTime(overview.order.createdAt) }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Livraison prévue</dt>
          <dd class="mt-0.5 font-medium">
            {{ formatDate(overview.order.expectedDate) }}
            · {{ orderEtaLabel(overview.order, overview.late) }}
          </dd>
        </div>
      </dl>

      <p class="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
        {{ overview.nextAction }}
      </p>

      <section v-if="overview.requests.length">
        <h3 class="text-sm font-semibold">Demandes liées</h3>
        <div class="mt-2 space-y-2">
          <button
            v-for="request in overview.requests"
            :key="request.id"
            class="w-full rounded-xl border px-3 py-2.5 text-left hover:bg-muted/40"
            @click="emit('openRequest', request.id)"
          >
            <p class="text-sm font-medium">{{ request.code }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ request.note }}</p>
          </button>
        </div>
      </section>

      <section>
        <h3 class="text-sm font-semibold">Articles commandés</h3>
        <div class="mt-2 space-y-2">
          <article v-for="line in overview.lines" :key="line.productId" class="rounded-xl border px-3 py-2.5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium">{{ line.productName }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ line.sku }} · {{ formatNumber(line.quantity) }} {{ line.unit }}s
                </p>
              </div>
              <p class="text-sm font-semibold">{{ formatMoney(line.amount) }}</p>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{{ formatMoney(line.unitPrice) }} / {{ line.unit }}</p>
          </article>
        </div>
        <p class="mt-3 text-right text-sm font-semibold">Total {{ formatMoney(overview.order.amount) }}</p>
      </section>

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

      <section v-if="overview.receiptCode">
        <h3 class="text-sm font-semibold">Documents liés</h3>
        <p class="mt-2 text-sm text-muted-foreground">
          <span v-if="overview.requests.length">{{ overview.requests.map((item) => item.code).join(' · ') }} → </span>
          {{ overview.code }} → {{ overview.receiptCode }}
        </p>
      </section>

      <OfficialDocument
        title="Ordre d’achat"
        :code="overview.code"
        :date="overview.order.createdAt"
        :issuer-name="issuer.name"
        :issuer-legal="issuer.legalName"
        :issuer-ice="issuer.ice"
        :issuer-city="issuer.city"
        :issuer-phone="issuer.phone"
        :issuer-email="issuer.email"
        :parties="[
          { title: 'Fournisseur', name: overview.supplierName },
          { title: 'Livrer à', name: overview.warehouseName, detail: `Prévu le ${formatDate(overview.order.expectedDate)}` },
        ]"
        :lines="oaLines"
        :total-label="`Total ${formatMoney(overview.order.amount)}`"
        :signatures="[
          { label: 'Acheteur', name: issuer.name },
          { label: 'Fournisseur', name: overview.supplierName },
        ]"
      />
    </div>
    <template #footer>
      <div class="space-y-2">
        <Button v-if="canChase" class="w-full" variant="default" @click="chaseOpen = true">
          <MessageCircle class="size-3.5" />
          Relancer le fournisseur
        </Button>
        <DocumentShareBar :filename="overview?.code ?? 'OA'" :message="oaMessage" :contacts="oaContacts" />
        <Button v-if="canConfirm" class="w-full" @click="emit('confirm')">Marquer comme confirmée</Button>
        <Button
          v-if="canReceive"
          class="w-full"
          :variant="canChase || canConfirm ? 'outline' : 'default'"
          @click="emit('receive')"
        >
          Réceptionner
        </Button>
        <WhatsAppShareSheet
          :open="chaseOpen"
          :contacts="oaContacts"
          :message="chaseMessage"
          :filename="overview?.code ?? 'OA'"
          @close="chaseOpen = false"
        />
      </div>
    </template>
  </Sheet>
</template>
