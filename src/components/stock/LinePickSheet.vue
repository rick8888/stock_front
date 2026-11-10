<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ScanBarcode } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import BarcodeScanSheet from '@/components/stock/BarcodeScanSheet.vue'
import type { WarehouseLocation } from '@/types'

export interface PickLine {
  key?: string
  productId: string
  productName: string
  sku?: string
  barcode?: string
  quantity: number
  unit?: string
  trackLots?: boolean
  locationId?: string | null
  locationCode?: string | null
  aisle?: string | null
  rack?: string | null
  bin?: string | null
  unlocated?: boolean
}

export interface PickedLine {
  productId: string
  received: number
  lotCode?: string
  expiryDate?: string
  locationId?: string
}

const props = defineProps<{
  open: boolean
  title: string
  lines: PickLine[]
  mode?: 'receive' | 'load'
  confirmLabel?: string
  locations?: WarehouseLocation[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [lines: PickedLine[]]
}>()

const qty = ref<Record<string, string>>({})
const lotCode = ref<Record<string, string>>({})
const expiryDate = ref<Record<string, string>>({})
const locationId = ref<Record<string, string>>({})
const confirmed = ref<Record<string, boolean>>({})
const activeKey = ref('')
const scanOpen = ref(false)
const scanError = ref('')
const manualCode = ref('')

function lineKey(line: PickLine, index: number) {
  return line.key ?? `${line.productId}:${line.locationId ?? 'x'}:${index}`
}

const keyedLines = computed(() => props.lines.map((line, index) => ({ ...line, key: lineKey(line, index) })))

watch(
  () => [props.open, props.lines] as const,
  ([open]) => {
    if (!open) return
    const nextQty: Record<string, string> = {}
    const nextLot: Record<string, string> = {}
    const nextExp: Record<string, string> = {}
    const nextLoc: Record<string, string> = {}
    const nextOk: Record<string, boolean> = {}
    keyedLines.value.forEach((line) => {
      nextQty[line.key] = String(line.quantity)
      nextLot[line.key] = ''
      nextExp[line.key] = ''
      nextLoc[line.key] = line.locationId ?? ''
      nextOk[line.key] = false
    })
    qty.value = nextQty
    lotCode.value = nextLot
    expiryDate.value = nextExp
    locationId.value = nextLoc
    confirmed.value = nextOk
    activeKey.value = keyedLines.value[0]?.key ?? ''
    scanError.value = ''
    manualCode.value = ''
  },
)

const progress = computed(() => keyedLines.value.filter((line) => confirmed.value[line.key]).length)
const allDone = computed(() => keyedLines.value.length > 0 && progress.value === keyedLines.value.length)
const active = computed(() => keyedLines.value.find((line) => line.key === activeKey.value))
const locationOptions = computed(() => (props.locations ?? []).filter((item) => item.active !== false))

function markConfirmed(key: string) {
  const line = keyedLines.value.find((item) => item.key === key)
  if (!line) return
  const value = Number(qty.value[key] ?? 0)
  if (value <= 0) {
    scanError.value = 'Quantité invalide'
    return
  }
  if (props.mode === 'receive' && line.trackLots && !lotCode.value[key]?.trim()) {
    scanError.value = 'Lot requis pour cet article'
    return
  }
  confirmed.value = { ...confirmed.value, [key]: true }
  scanError.value = ''
  const next = keyedLines.value.find((item) => !confirmed.value[item.key])
  if (next) activeKey.value = next.key
}

function matchCode(code: string) {
  const normalized = code.trim().toLowerCase()
  if (!normalized) return
  const hit =
    keyedLines.value.find(
      (line) =>
        line.key === activeKey.value &&
        (line.barcode?.toLowerCase() === normalized ||
          line.sku?.toLowerCase() === normalized ||
          line.locationCode?.toLowerCase() === normalized ||
          line.productId.toLowerCase() === normalized),
    ) ??
    keyedLines.value.find(
      (line) =>
        line.barcode?.toLowerCase() === normalized ||
        line.sku?.toLowerCase() === normalized ||
        line.locationCode?.toLowerCase() === normalized ||
        line.productId.toLowerCase() === normalized,
    )
  if (!hit) {
    scanError.value = `Code inconnu : ${code}`
    return
  }
  activeKey.value = hit.key
  markConfirmed(hit.key)
}

function onDetect(code: string) {
  matchCode(code)
}

function submitManual() {
  matchCode(manualCode.value)
  manualCode.value = ''
}

function submit() {
  if (!allDone.value) return
  emit(
    'confirm',
    keyedLines.value.map((line) => ({
      productId: line.productId,
      received: Number(qty.value[line.key] ?? line.quantity),
      lotCode: lotCode.value[line.key]?.trim() || undefined,
      expiryDate: expiryDate.value[line.key]?.trim() || undefined,
      locationId: locationId.value[line.key]?.trim() || line.locationId || undefined,
    })),
  )
}
</script>

<template>
  <Sheet :open="open" :title="title" wide @close="emit('close')">
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        {{ progress }} / {{ keyedLines.length }} étape(s). Scannez l’article ou l’emplacement.
      </p>
      <div class="flex gap-2">
        <Input v-model="manualCode" class="flex-1" placeholder="Douchette / SKU / emplacement" @keyup.enter="submitManual" />
        <Button variant="outline" @click="submitManual">OK</Button>
        <Button size="icon" variant="outline" aria-label="Caméra" @click="scanOpen = true">
          <ScanBarcode class="size-4" />
        </Button>
      </div>
      <p v-if="scanError" class="text-sm text-destructive">{{ scanError }}</p>
      <div class="space-y-2">
        <article
          v-for="line in keyedLines"
          :key="line.key"
          class="rounded-xl border px-3 py-2.5 transition-colors"
          :class="[
            confirmed[line.key] ? 'border-emerald-300 bg-emerald-50/50' : '',
            activeKey === line.key && !confirmed[line.key] ? 'ring-1 ring-primary/30' : '',
          ]"
          @click="activeKey = line.key"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-medium">{{ line.productName }}</p>
              <p class="text-xs text-muted-foreground">
                <span v-if="line.locationCode" class="font-medium text-foreground">{{ line.locationCode }} · </span>
                <span v-else-if="line.unlocated" class="text-amber-700">Sans emplacement · </span>
                {{ line.sku }}
                <span v-if="line.barcode"> · {{ line.barcode }}</span>
                · {{ line.quantity }} {{ line.unit ?? 'u' }}
              </p>
            </div>
            <Check v-if="confirmed[line.key]" class="size-4 text-emerald-600" />
          </div>
          <div v-if="!confirmed[line.key] && activeKey === line.key" class="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              <Label>Qté</Label>
              <Input v-model="qty[line.key]" type="number" min="0" class="mt-1" />
            </div>
            <template v-if="mode === 'receive' && line.trackLots">
              <div>
                <Label>Lot</Label>
                <Input v-model="lotCode[line.key]" class="mt-1" placeholder="LOT-…" />
              </div>
              <div>
                <Label>DLC</Label>
                <Input v-model="expiryDate[line.key]" type="date" class="mt-1" />
              </div>
            </template>
            <div v-if="mode === 'receive' && locationOptions.length" class="sm:col-span-3">
              <Label>Putaway</Label>
              <select v-model="locationId[line.key]" class="mt-1 h-10 w-full rounded-lg border bg-card px-3 text-sm">
                <option value="">Suggestion auto</option>
                <option v-for="loc in locationOptions" :key="loc.id" :value="loc.id">
                  {{ loc.code }} · {{ loc.type }}
                </option>
              </select>
            </div>
            <div class="sm:col-span-3">
              <Button size="sm" class="w-full" @click="markConfirmed(line.key)">Confirmer la ligne</Button>
            </div>
          </div>
        </article>
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!allDone" @click="submit">
        {{ confirmLabel ?? (mode === 'load' ? 'Charger' : 'Valider') }}
      </Button>
    </template>
  </Sheet>
  <BarcodeScanSheet :open="scanOpen" @close="scanOpen = false" @detect="onDetect" />
</template>
