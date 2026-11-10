<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import { formatDate, formatNumber } from '@/lib/utils'
import { RECEIPT_LABEL } from '@/services/receipt.overview'
import type { ReceiptOverview } from '@/services/receipt.overview'
import OfficialDocument from '@/components/documents/OfficialDocument.vue'
import DocumentShareBar from '@/components/documents/DocumentShareBar.vue'
import LinePickSheet, { type PickedLine } from '@/components/stock/LinePickSheet.vue'
import { useIssuer } from '@/composables/useIssuer'
import { locationRepository } from '@/repositories'
import { documentWhatsAppMessage } from '@/utils/documents'
import type { WarehouseLocation } from '@/types'

const props = defineProps<{ open: boolean; overview: ReceiptOverview | null; canReceive: boolean }>()
const emit = defineEmits<{
  close: []
  validate: [lines: { productId: string; received: number; lotCode?: string; expiryDate?: string; locationId?: string }[]]
}>()
const { issuer } = useIssuer()

const qty = ref<Record<string, string>>({})
const lotCode = ref<Record<string, string>>({})
const expiryDate = ref<Record<string, string>>({})
const locationId = ref<Record<string, string>>({})
const locations = ref<WarehouseLocation[]>([])
const pickOpen = ref(false)

watch(
  () => props.overview?.receipt.id,
  async () => {
    const next: Record<string, string> = {}
    const nextLot: Record<string, string> = {}
    const nextExp: Record<string, string> = {}
    const nextLoc: Record<string, string> = {}
    props.overview?.lines.forEach((line) => {
      next[line.productId] = String(line.received || line.expected)
      nextLot[line.productId] = line.lotCode ?? ''
      nextExp[line.productId] = line.expiryDate ?? ''
      nextLoc[line.productId] = line.locationId ?? ''
    })
    qty.value = next
    lotCode.value = nextLot
    expiryDate.value = nextExp
    locationId.value = nextLoc
    pickOpen.value = false
    const warehouseId = props.overview?.receipt.warehouseId
    locations.value = warehouseId ? await locationRepository.list(warehouseId) : []
  },
  { immediate: true },
)

const pending = computed(() => props.overview && props.overview.receipt.status !== 'validated')

const pickLines = computed(() =>
  (props.overview?.lines ?? []).map((line) => ({
    productId: line.productId,
    productName: line.productName,
    sku: line.sku,
    barcode: line.barcode,
    quantity: line.expected,
    unit: line.unit,
    trackLots: line.trackLots,
  })),
)

const brLines = computed(() =>
  (props.overview?.lines ?? []).map((line) => ({
    name: line.productName,
    sku: line.sku,
    qty: `Reçu ${formatNumber(line.received)} / ${formatNumber(line.expected)} ${line.unit}`,
  })),
)

const brContacts = computed(() => {
  const phone = props.overview?.supplierPhone
  if (!phone) return []
  return [{ label: props.overview!.supplierName, phone, hint: 'Fournisseur' }]
})

const brMessage = computed(() => {
  const item = props.overview
  if (!item) return ''
  return documentWhatsAppMessage({
    title: 'Bon de réception',
    code: item.code,
    issuer: issuer.value.name,
    lines: [
      `Commande : ${item.orderCode}`,
      `Fournisseur : ${item.supplierName}`,
      `Entrepôt : ${item.warehouseName}`,
      ...item.lines.map((line) => `• ${line.productName} : ${line.received}/${line.expected} ${line.unit}`),
    ],
  })
})

function variant(status: string) {
  if (status === 'validated') return 'success' as const
  if (status === 'partial') return 'warning' as const
  return 'info' as const
}

function submit() {
  if (!props.overview) return
  emit(
    'validate',
    props.overview.lines.map((line) => ({
      productId: line.productId,
      received: Number(qty.value[line.productId] ?? line.expected),
      lotCode: lotCode.value[line.productId]?.trim() || undefined,
      expiryDate: expiryDate.value[line.productId]?.trim() || undefined,
      locationId: locationId.value[line.productId]?.trim() || undefined,
    })),
  )
}

function onPicked(lines: PickedLine[]) {
  pickOpen.value = false
  emit('validate', lines)
}
</script>

<template>
  <Sheet :open="open && !!overview" :title="overview?.code" @close="emit('close')">
    <div v-if="overview" class="space-y-6">
      <div class="flex flex-wrap items-center gap-2">
        <Badge :variant="variant(overview.receipt.status)">{{ RECEIPT_LABEL[overview.receipt.status] }}</Badge>
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt class="text-xs text-muted-foreground">Commande</dt>
          <dd class="mt-0.5 font-medium">{{ overview.orderCode }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Demande</dt>
          <dd class="mt-0.5 font-medium">{{ overview.requestCode ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Fournisseur</dt>
          <dd class="mt-0.5 font-medium">{{ overview.supplierName }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Entrepôt</dt>
          <dd class="mt-0.5 font-medium">{{ overview.warehouseName }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Attendu le</dt>
          <dd class="mt-0.5 font-medium">{{ formatDate(overview.expectedDate) }}</dd>
        </div>
      </dl>
      <section>
        <h3 class="text-sm font-semibold">Contrôle d’arrivage</h3>
        <div class="mt-2 space-y-2">
          <article v-for="line in overview.lines" :key="line.productId" class="rounded-xl border px-3 py-2.5">
            <p class="text-sm font-medium">{{ line.productName }}</p>
            <p class="text-xs text-muted-foreground">{{ line.sku }} · attendu {{ formatNumber(line.expected) }} {{ line.unit }}s</p>
            <div v-if="pending && canReceive" class="mt-2 space-y-2">
              <Input v-model="qty[line.productId]" type="number" min="0" />
              <div v-if="line.trackLots" class="grid grid-cols-2 gap-2">
                <Input v-model="lotCode[line.productId]" placeholder="Lot" />
                <Input v-model="expiryDate[line.productId]" type="date" />
              </div>
              <select v-if="locations.length" v-model="locationId[line.productId]" class="h-10 w-full rounded-lg border bg-card px-3 text-sm">
                <option value="">Putaway auto</option>
                <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.code }} · {{ loc.type }}</option>
              </select>
            </div>
            <p v-else class="mt-1 text-xs text-muted-foreground">Reçu {{ formatNumber(line.received) }}</p>
          </article>
        </div>
      </section>
      <p v-if="overview.variance < 0 && overview.receipt.status !== 'pending'" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Écart : {{ formatNumber(overview.variance) }} par rapport à la commande.
      </p>
      <OfficialDocument
        title="Bon de réception"
        :code="overview.code"
        :date="overview.receipt.date"
        :issuer-name="issuer.name"
        :issuer-legal="issuer.legalName"
        :issuer-ice="issuer.ice"
        :issuer-city="issuer.city"
        :issuer-phone="issuer.phone"
        :issuer-email="issuer.email"
        :parties="[
          { title: 'Fournisseur', name: overview.supplierName },
          { title: 'Entrepôt', name: overview.warehouseName, detail: overview.orderCode },
        ]"
        :lines="brLines"
        :notes="overview.variance ? `Écart : ${formatNumber(overview.variance)}` : ''"
        :signatures="[
          { label: 'Réception magasin' },
          { label: 'Signature livreur / fournisseur', name: overview.supplierName },
        ]"
      />
    </div>
    <template #footer>
      <div class="space-y-2">
        <DocumentShareBar :filename="overview?.code ?? 'BR'" :message="brMessage" :contacts="brContacts" />
        <Button v-if="pending && canReceive" class="w-full" variant="outline" @click="pickOpen = true">
          Picking guidé + scan
        </Button>
        <Button v-if="pending && canReceive" class="w-full" @click="submit">Valider la réception</Button>
      </div>
    </template>
  </Sheet>
  <LinePickSheet
    :open="pickOpen"
    title="Picking réception"
    mode="receive"
    confirm-label="Valider la réception"
    :lines="pickLines"
    :locations="locations"
    @close="pickOpen = false"
    @confirm="onPicked"
  />
</template>
