<script setup lang="ts">
import { computed, inject, ref, watch, type ComputedRef, type Ref } from 'vue'
import { FileText, Loader2, Mail, Paperclip } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { formatDate, formatMoney, consultationCode } from '@/lib/utils'
import { ACTION_BUSY_KEY } from '@/composables/useActionBusy'
import type { Consultation, QuoteFile, Supplier } from '@/types'
import type { SourcingOffer } from '@/services/sourcing.service'

const MAX_FILE_SIZE = 2_000_000

const props = defineProps<{
  consultation?: Consultation | null
  offers: SourcingOffer[]
  suppliers: Supplier[]
  canAct: boolean
}>()

const emit = defineEmits<{
  launch: [payload: { supplierIds: string[]; note: string }]
  award: [quoteId: string]
  cancel: []
  attach: [payload: { quoteId: string; file: QuoteFile }]
}>()

const sheetBusy = inject<ComputedRef<boolean> | Ref<boolean> | undefined>(ACTION_BUSY_KEY, undefined)

const selectedIds = ref<string[]>([])
const note = ref('')
const fileError = ref<Record<string, string>>({})

const activeSuppliers = computed(() => props.suppliers.filter((item) => item.status === 'active'))

watch(
  () => [props.consultation?.id, props.offers.map((item) => item.supplierId).join(',')],
  () => {
    if (props.consultation) return
    const fromOffers = props.offers.map((item) => item.supplierId)
    selectedIds.value = fromOffers.length ? fromOffers : activeSuppliers.value.slice(0, 3).map((item) => item.id)
    note.value = ''
  },
  { immediate: true },
)

function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

const received = computed(() =>
  (props.consultation?.quotes ?? []).filter((item) => item.status === 'received'),
)

const cheapest = computed(() => Math.min(...received.value.map((item) => item.amount ?? Infinity)))

function supplierName(id: string) {
  return props.suppliers.find((item) => item.id === id)?.name ?? id
}

function referenceAmount(supplierId: string) {
  return props.offers.find((item) => item.supplierId === supplierId)?.amount
}

function deltaLabel(quoteAmount: number, supplierId: string) {
  const reference = referenceAmount(supplierId)
  if (reference == null) return ''
  const delta = Math.round(quoteAmount - reference)
  if (delta === 0) return 'Égal à la référence'
  if (delta < 0) return `${formatMoney(Math.abs(delta))} de moins que la référence`
  return `${formatMoney(delta)} de plus que la référence`
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1_048_576).toFixed(1)} Mo`
}

function onFile(quoteId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
  if (file.type && !allowed.includes(file.type)) {
    fileError.value = { ...fileError.value, [quoteId]: 'PDF ou image uniquement.' }
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    fileError.value = { ...fileError.value, [quoteId]: 'Fichier trop volumineux (2 Mo max).' }
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result ?? '')
    if (!dataUrl) return
    fileError.value = { ...fileError.value, [quoteId]: '' }
    emit('attach', {
      quoteId,
      file: { name: file.name, size: file.size, type: file.type || 'application/pdf', dataUrl },
    })
  }
  reader.readAsDataURL(file)
}

const open = computed(
  () => props.consultation && !['awarded', 'cancelled'].includes(props.consultation.status),
)
const awarded = computed(() => props.consultation?.status === 'awarded')
</script>

<template>
  <section v-if="consultation || canAct" class="space-y-3">
    <div class="rounded-xl border px-3 py-3">
      <p class="flex items-center gap-2 text-sm font-semibold">
        <Mail class="size-4" />
        Consultation fournisseurs
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        Envoyer un appel à devis. Joignez le fichier reçu avant de retenir une offre.
      </p>

      <div v-if="!consultation && canAct" class="mt-3 space-y-3">
        <p class="text-xs font-medium text-muted-foreground">Fournisseurs à consulter</p>
        <label
          v-for="supplier in activeSuppliers"
          :key="supplier.id"
          class="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-muted/50"
        >
          <input
            type="checkbox"
            class="mt-1 size-4 rounded border-input"
            :checked="selectedIds.includes(supplier.id)"
            @change="toggle(supplier.id)"
          />
          <span>
            <span class="text-sm font-medium">{{ supplier.name }}</span>
            <span class="block text-xs text-muted-foreground">
              {{ supplier.city }} · {{ supplier.leadTimeDays }} j
              <template v-if="offers.some((item) => item.supplierId === supplier.id)"> · dans la référence</template>
            </span>
          </span>
        </label>
        <div>
          <Label>Message (optionnel)</Label>
          <Input v-model="note" class="mt-1.5" placeholder="Urgence, volume, délai souhaité…" />
        </div>
        <Button class="w-full" :disabled="selectedIds.length < 2" @click="emit('launch', { supplierIds: selectedIds, note })">
          Lancer la consultation ({{ selectedIds.length }})
        </Button>
      </div>

      <div v-else-if="consultation" class="mt-3 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-medium">{{ consultationCode(consultation.id, consultation.code) }}</p>
          <Badge :variant="awarded ? 'success' : open ? 'onorder' : 'outline'">
            {{ awarded ? 'Devis retenu' : consultation.status === 'quoted' ? 'Devis reçus' : 'Envoyée' }}
          </Badge>
        </div>
        <p v-if="consultation.note" class="text-xs text-muted-foreground">{{ consultation.note }}</p>
        <p v-if="canAct && open" class="text-xs text-muted-foreground">
          Un fichier devis (PDF ou image) est obligatoire avant de retenir une offre.
        </p>

        <article
          v-for="quote in received"
          :key="quote.id"
          class="rounded-xl border px-3 py-2.5"
          :class="quote.amount === cheapest ? 'border-primary/40 bg-primary/5' : ''"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium">{{ supplierName(quote.supplierId) }}</p>
              <p class="text-xs text-muted-foreground">
                {{ quote.leadTimeDays }} j
                <template v-if="quote.validUntil"> · valable jusqu’au {{ formatDate(quote.validUntil) }}</template>
              </p>
            </div>
            <p class="text-sm font-semibold">{{ formatMoney(quote.amount ?? 0) }}</p>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <Badge v-if="quote.amount === cheapest" variant="info">Meilleur prix</Badge>
            <Badge v-if="consultation.awardedQuoteId === quote.id" variant="success">Retenu</Badge>
            <Badge v-if="quote.file" variant="success">Fichier joint</Badge>
          </div>
          <p v-if="quote.amount != null" class="mt-1 text-xs text-muted-foreground">
            {{ deltaLabel(quote.amount, quote.supplierId) }}
          </p>
          <p v-if="quote.note" class="mt-1 text-xs text-muted-foreground">{{ quote.note }}</p>

          <div class="mt-3 rounded-lg border bg-muted/30 px-3 py-2">
            <a
              v-if="quote.file"
              :href="quote.file.dataUrl"
              :download="quote.file.name"
              target="_blank"
              rel="noreferrer"
              class="flex items-center gap-2 text-sm text-foreground hover:underline"
            >
              <FileText class="size-4 shrink-0" />
              <span class="min-w-0 truncate">{{ quote.file.name }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ formatSize(quote.file.size) }}</span>
            </a>
            <p v-else class="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip class="size-4 shrink-0" />
              Aucun fichier devis
            </p>
            <label
              v-if="canAct && open"
              class="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary"
              :class="sheetBusy ? 'pointer-events-none opacity-60' : ''"
            >
              <input
                type="file"
                class="hidden"
                accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                :disabled="!!sheetBusy"
                @change="onFile(quote.id, $event)"
              />
              <Loader2 v-if="sheetBusy" class="size-3 animate-spin" />
              {{ quote.file ? 'Remplacer le fichier' : 'Joindre le devis fournisseur' }}
            </label>
            <p v-if="fileError[quote.id]" class="mt-1 text-xs text-red-600">{{ fileError[quote.id] }}</p>
          </div>

          <Button
            v-if="canAct && open"
            class="mt-3 w-full"
            :variant="quote.amount === cheapest ? 'default' : 'outline'"
            :disabled="!quote.file"
            @click="emit('award', quote.id)"
          >
            {{ quote.file ? 'Retenir ce devis' : 'Joindre le fichier pour retenir' }}
          </Button>
        </article>

        <Button v-if="canAct && open" variant="outline" class="w-full" @click="emit('cancel')">
          Annuler la consultation
        </Button>
      </div>
    </div>
  </section>
</template>
