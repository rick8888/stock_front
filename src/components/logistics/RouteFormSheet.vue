<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Sparkles, Trash2 } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import ShippingNotePreview from '@/components/logistics/ShippingNotePreview.vue'
import { DEMO_TODAY } from '@/utils/helpers'
import { DELIVERY_LABEL, ROUTE_LABEL } from '@/config/logistics'
import { availableShippingNotes, shippingNoteLabel } from '@/utils/shippingNotes'
import { logisticsService } from '@/services/logistics.service'
import type { RouteAssistResult } from '@/services/route.assist'
import type { Delivery, DeliveryStatus, Route, RouteStatus, ShippingNote, Vehicle, Warehouse } from '@/types'
import type { RouteInput, RouteStopInput } from '@/repositories/interfaces'

interface FormStop {
  key: string
  id?: string
  shippingNoteId: string
  time: string
  status: DeliveryStatus
}

const props = defineProps<{
  open: boolean
  route?: Route | null
  deliveries?: Delivery[]
  warehouses: Warehouse[]
  vehicles: Vehicle[]
  drivers: { id: string; name: string }[]
  shippingNotes: ShippingNote[]
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: RouteInput }]
}>()

const name = ref('')
const date = ref(DEMO_TODAY)
const warehouseId = ref('')
const driverId = ref('')
const vehicleId = ref('')
const status = ref<RouteStatus>('planned')
const stops = ref<FormStop[]>([])
const assistBusy = ref(false)
const assistError = ref<string | null>(null)
const assist = ref<RouteAssistResult | null>(null)

const editing = computed(() => Boolean(props.route))
const parsedStops = computed(() => stops.value.filter((stop) => stop.shippingNoteId && stop.time))
const uniqueNotes = computed(() => new Set(parsedStops.value.map((stop) => stop.shippingNoteId)).size)
const canAssist = computed(() => warehouseId.value && parsedStops.value.length > 0)
const canSubmit = computed(
  () =>
    name.value.trim().length > 1 &&
    date.value &&
    warehouseId.value &&
    driverId.value &&
    vehicleId.value &&
    parsedStops.value.length > 0 &&
    parsedStops.value.length === stops.value.length &&
    uniqueNotes.value === parsedStops.value.length,
)

const routeStatuses: RouteStatus[] = ['planned', 'in_progress', 'done']
const stopStatuses: DeliveryStatus[] = ['prepared', 'in_transit', 'at_risk', 'delivered', 'failed']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function timeOf(iso: string) {
  const value = new Date(iso)
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function nextTime() {
  const last = stops.value[stops.value.length - 1]?.time
  if (!last) return '09:00'
  const [hours, minutes] = last.split(':').map(Number)
  const total = hours * 60 + minutes + 30
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}

function takenIds(exceptKey?: string) {
  return stops.value.filter((stop) => stop.key !== exceptKey).map((stop) => stop.shippingNoteId)
}

function optionsFor(stop: FormStop) {
  return availableShippingNotes(props.shippingNotes, {
    warehouseId: warehouseId.value,
    keepIds: [stop.shippingNoteId],
    excludeAssignedToOtherDelivery: stop.id ?? '',
  }).filter((note) => !takenIds(stop.key).includes(note.id))
}

function firstAvailableId(exceptKey?: string) {
  const taken = new Set(takenIds(exceptKey))
  return (
    availableShippingNotes(props.shippingNotes, {
      warehouseId: warehouseId.value,
      excludeAssignedToOtherDelivery: '',
    }).find((note) => !taken.has(note.id))?.id ?? ''
  )
}

function noteOf(id: string) {
  return props.shippingNotes.find((item) => item.id === id)
}

function stopNote(stop: FormStop) {
  const note = noteOf(stop.shippingNoteId)
  return note ? [note] : []
}

function blankStop(): FormStop {
  return {
    key: `st-${Math.random().toString(36).slice(2, 8)}`,
    shippingNoteId: firstAvailableId(),
    time: nextTime(),
    status: 'prepared',
  }
}

function stopVariant(value: DeliveryStatus) {
  if (value === 'delivered') return 'success' as const
  if (value === 'at_risk' || value === 'failed') return 'warning' as const
  if (value === 'in_transit') return 'onorder' as const
  return 'outline' as const
}

function reset() {
  const current = props.route
  name.value = current?.name ?? ''
  date.value = current?.date ?? DEMO_TODAY
  warehouseId.value = current?.warehouseId ?? props.warehouses[0]?.id ?? ''
  driverId.value = current?.driverId ?? props.drivers[0]?.id ?? ''
  vehicleId.value = current?.vehicleId ?? props.vehicles[0]?.id ?? ''
  status.value = current?.status ?? 'planned'
  assist.value = null
  assistError.value = null
  const existing = (props.deliveries ?? [])
    .filter((item) => item.routeId === current?.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((item) => ({
      key: item.id,
      id: item.id,
      shippingNoteId: item.shippingNoteId ?? '',
      time: timeOf(item.scheduledAt),
      status: item.status,
    }))
  stops.value = existing.length ? existing : [blankStop()]
}

async function suggestDispatch() {
  if (!canAssist.value || assistBusy.value) return
  assistBusy.value = true
  assistError.value = null
  try {
    const result = await logisticsService.assistRoute({
      warehouseId: warehouseId.value,
      date: date.value,
      driverId: driverId.value || undefined,
      vehicleId: vehicleId.value || undefined,
      stops: parsedStops.value.map((stop) => {
        const note = noteOf(stop.shippingNoteId)
        return {
          key: stop.key,
          shippingNoteId: stop.shippingNoteId,
          client: note?.client,
          city: note?.city,
          address: note?.address,
          scheduledAt: new Date(`${date.value}T${stop.time}`).toISOString(),
          status: stop.status,
        }
      }),
    })
    const byKey = new Map(stops.value.map((stop) => [stop.key, stop]))
    const byNote = new Map(stops.value.map((stop) => [stop.shippingNoteId, stop]))
    const reordered = result.stops
      .map((item) => byKey.get(item.key) ?? byNote.get(item.shippingNoteId) ?? null)
      .filter((item): item is FormStop => Boolean(item))
    if (reordered.length === stops.value.length) stops.value = reordered
    const recommendedDriver = result.drivers.find((item) => item.recommended)
    const recommendedVehicle = result.vehicles.find((item) => item.recommended)
    if (recommendedDriver && props.drivers.some((item) => item.id === recommendedDriver.driverId)) {
      driverId.value = recommendedDriver.driverId
    }
    if (recommendedVehicle && props.vehicles.some((item) => item.id === recommendedVehicle.vehicleId)) {
      vehicleId.value = recommendedVehicle.vehicleId
    }
    assist.value = result
  } catch (err) {
    assistError.value = err instanceof Error ? err.message : 'Suggestion indisponible'
  } finally {
    assistBusy.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

watch(
  () => props.route?.id,
  (id, previous) => {
    if (props.open && id !== previous) reset()
  },
)

// Hydrate les arrêts quand les livraisons de la tournée éditée arrivent (1re fois).
watch(
  () =>
    props.route?.id
      ? (props.deliveries ?? []).filter((item) => item.routeId === props.route?.id).length
      : 0,
  (count, previous) => {
    if (!props.open || !props.route?.id) return
    if (count > 0 && (previous ?? 0) === 0) reset()
  },
)

function addStop() {
  stops.value.push(blankStop())
}

function removeStop(key: string) {
  if (stops.value.length === 1) return
  stops.value = stops.value.filter((item) => item.key !== key)
}

function toStops(): RouteStopInput[] {
  return parsedStops.value.map((stop) => {
    const note = noteOf(stop.shippingNoteId)
    return {
      id: stop.id,
      shippingNoteId: stop.shippingNoteId,
      client: note?.client,
      address: note?.address,
      city: note?.city,
      scheduledAt: new Date(`${date.value}T${stop.time}`).toISOString(),
      status: stop.status,
    }
  })
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.route?.id,
    input: {
      name: name.value.trim(),
      date: date.value,
      warehouseId: warehouseId.value,
      driverId: driverId.value,
      vehicleId: vehicleId.value,
      status: status.value,
      stops: toStops(),
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier la tournée' : 'Nouvelle tournée'" xl @close="emit('close')">
    <div class="space-y-5">
      <div>
        <Label>Nom</Label>
        <Input v-model="name" class="mt-1.5" placeholder="Casa centre — 27 août" />
      </div>
      <div>
        <Label>Date</Label>
        <Input v-model="date" type="date" class="mt-1.5" />
      </div>
      <div>
        <Label>Entrepôt de départ</Label>
        <select v-model="warehouseId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
      </div>
      <div>
        <Label>Chauffeur</Label>
        <select v-model="driverId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="driver in drivers" :key="driver.id" :value="driver.id">{{ driver.name }}</option>
        </select>
      </div>
      <div>
        <Label>Véhicule</Label>
        <select v-model="vehicleId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
            {{ vehicle.name }} · {{ vehicle.plate }}
          </option>
        </select>
      </div>
      <div v-if="editing">
        <Label>Statut</Label>
        <select v-model="status" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="item in routeStatuses" :key="item" :value="item">{{ ROUTE_LABEL[item] }}</option>
        </select>
      </div>

      <div v-if="assist" class="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p class="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles class="size-4" />
          Suggestion dispatch
        </p>
        <p class="mt-2 text-sm">
          Classement par urgence, ville et proximité — pas une optimisation automatique.
          <template v-if="assist.distanceKm"> Distance indicative {{ assist.distanceKm }} km.</template>
        </p>
        <ul class="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <li v-for="reason in assist.reasons" :key="reason">· {{ reason }}</li>
        </ul>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <Badge v-if="assist.drivers.find((item) => item.recommended)" variant="info">
            Chauffeur {{ assist.drivers.find((item) => item.recommended)?.name }}
          </Badge>
          <Badge v-if="assist.vehicles.find((item) => item.recommended)" variant="outline">
            {{ assist.vehicles.find((item) => item.recommended)?.name }}
          </Badge>
        </div>
      </div>
      <p v-if="assistError" class="text-sm text-destructive">{{ assistError }}</p>

      <section>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Feuille de tournée</h3>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="!canAssist || assistBusy" @click="suggestDispatch">
              <Sparkles class="size-3.5" />
              {{ assistBusy ? 'Suggestion…' : 'Proposer ordre & flotte' }}
            </Button>
            <Button size="sm" variant="outline" @click="addStop">
              <Plus class="size-3.5" />
              Ajouter un arrêt
            </Button>
          </div>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          Chaque point reprend un bon de livraison préparé. Le client et les articles ne se construisent pas ici.
        </p>
        <div class="mt-3 divide-y overflow-hidden rounded-xl border">
          <article v-for="(stop, index) in stops" :key="stop.key" class="bg-card px-3 py-3">
            <div class="flex items-start justify-between gap-2">
              <p class="pt-2 text-sm font-semibold tabular-nums text-muted-foreground">{{ index + 1 }}.</p>
              <div class="min-w-0 flex-1 space-y-2">
                <select v-model="stop.shippingNoteId" class="h-10 w-full rounded-lg border bg-card px-2 text-sm">
                  <option value="">Choisir un bon de livraison</option>
                  <option v-for="note in optionsFor(stop)" :key="note.id" :value="note.id">
                    {{ shippingNoteLabel(note) }}
                  </option>
                </select>
                <div class="grid gap-2 sm:grid-cols-[7rem_1fr]">
                  <Input v-model="stop.time" type="time" />
                  <select v-model="stop.status" class="h-10 rounded-lg border bg-card px-2 text-sm">
                    <option v-for="item in stopStatuses" :key="item" :value="item">{{ DELIVERY_LABEL[item] }}</option>
                  </select>
                </div>
                <ShippingNotePreview v-for="note in stopNote(stop)" :key="note.id" :note="note" />
              </div>
              <div class="flex flex-col items-end gap-2 pt-1">
                <Badge :variant="stopVariant(stop.status)">{{ DELIVERY_LABEL[stop.status] }}</Badge>
                <Button size="icon" variant="destructive" :disabled="stops.length === 1" @click="removeStop(stop.key)">
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">Enregistrer</Button>
    </template>
  </Sheet>
</template>
