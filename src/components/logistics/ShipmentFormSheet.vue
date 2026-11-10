<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import ShippingNotePreview from '@/components/logistics/ShippingNotePreview.vue'
import { DEMO_TODAY, opsToday } from '@/utils/helpers'
import { SHIPMENT_LABEL } from '@/config/logistics'
import { availableShippingNotes, shippingNoteLabel } from '@/utils/shippingNotes'
import type { Delivery, Route, Shipment, ShipmentStatus, ShippingNote, Vehicle, Warehouse } from '@/types'
import type { ShipmentInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  shipment?: Shipment | null
  warehouses: Warehouse[]
  vehicles: Vehicle[]
  drivers: { id: string; name: string }[]
  routes: Route[]
  deliveries: Delivery[]
  shippingNotes: ShippingNote[]
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: ShipmentInput }]
}>()

const kind = ref<'route' | 'transfer'>('route')
const originWarehouseId = ref('')
const destinationWarehouseId = ref('')
const destination = ref('')
const routeId = ref('')
const driverId = ref('')
const vehicleId = ref('')
const date = ref(`${DEMO_TODAY}T07:30`)
const eta = ref(`${DEMO_TODAY}T16:00`)
const notes = ref('')
const status = ref<ShipmentStatus>('preparing')
const shippingNoteIds = ref<string[]>([])
const pickerId = ref('')

const editing = computed(() => Boolean(props.shipment))
const canSubmit = computed(() => {
  if (!originWarehouseId.value || !driverId.value || !vehicleId.value || !date.value) return false
  if (!shippingNoteIds.value.length) return false
  if (kind.value === 'route') return Boolean(routeId.value)
  return Boolean(destinationWarehouseId.value && destinationWarehouseId.value !== originWarehouseId.value)
})

const statuses: ShipmentStatus[] = ['preparing', 'in_transit', 'delayed', 'done']
const selectedNotes = computed(() =>
  shippingNoteIds.value
    .map((id) => props.shippingNotes.find((item) => item.id === id))
    .filter((item): item is ShippingNote => Boolean(item)),
)
const pickerOptions = computed(() =>
  availableShippingNotes(props.shippingNotes, {
    warehouseId: originWarehouseId.value,
    keepIds: kind.value === 'route' ? notesOnRoute(routeId.value) : [],
    excludeAssignedToOtherShipment: props.shipment?.id ?? '',
  }).filter((note) => !shippingNoteIds.value.includes(note.id)),
)

const statusesReady = computed(() => pickerOptions.value.length > 0)

function toLocal(iso: string) {
  const value = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function notesOnRoute(id: string) {
  return props.deliveries
    .filter((item) => item.routeId === id && item.shippingNoteId)
    .map((item) => item.shippingNoteId as string)
}

function applyRoute(id: string) {
  const route = props.routes.find((item) => item.id === id)
  if (!route) return
  originWarehouseId.value = route.warehouseId
  driverId.value = route.driverId
  vehicleId.value = route.vehicleId
  destination.value = route.name
  if (!editing.value) shippingNoteIds.value = notesOnRoute(id)
}

function reset() {
  const current = props.shipment
  kind.value = current?.destinationWarehouseId ? 'transfer' : 'route'
  originWarehouseId.value = current?.originWarehouseId ?? props.warehouses[0]?.id ?? ''
  destinationWarehouseId.value = current?.destinationWarehouseId ?? props.warehouses[1]?.id ?? ''
  destination.value = current?.destination ?? ''
  routeId.value = current?.routeId ?? props.routes[0]?.id ?? ''
  driverId.value = current?.driverId ?? props.drivers[0]?.id ?? ''
  vehicleId.value = current?.vehicleId ?? props.vehicles[0]?.id ?? ''
  date.value = current?.date ? toLocal(current.date) : `${DEMO_TODAY}T07:30`
  eta.value = current?.eta ? toLocal(current.eta) : `${DEMO_TODAY}T16:00`
  notes.value = current?.notes ?? ''
  status.value = current?.status ?? 'preparing'
  pickerId.value = ''
  shippingNoteIds.value = current?.shippingNoteIds?.length
    ? [...current.shippingNoteIds]
    : kind.value === 'route' && routeId.value
      ? notesOnRoute(routeId.value)
      : []
  if (!current && kind.value === 'route' && routeId.value) applyRoute(routeId.value)
}

watch(
  () => [props.open, props.shipment?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

watch(kind, (value) => {
  if (!props.open || editing.value) return
  if (value === 'transfer') shippingNoteIds.value = []
  else if (routeId.value) applyRoute(routeId.value)
})

watch(routeId, (id) => {
  if (kind.value === 'route' && id && !editing.value) applyRoute(id)
})

function addNote() {
  if (!pickerId.value || shippingNoteIds.value.includes(pickerId.value)) return
  shippingNoteIds.value = [...shippingNoteIds.value, pickerId.value]
  pickerId.value = ''
}

function removeNote(id: string) {
  shippingNoteIds.value = shippingNoteIds.value.filter((item) => item !== id)
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.shipment?.id,
    input: {
      originWarehouseId: originWarehouseId.value,
      destinationWarehouseId: kind.value === 'transfer' ? destinationWarehouseId.value : undefined,
      destination:
        kind.value === 'transfer'
          ? props.warehouses.find((item) => item.id === destinationWarehouseId.value)?.name
          : destination.value.trim() || undefined,
      vehicleId: vehicleId.value,
      driverId: driverId.value,
      routeId: kind.value === 'route' ? routeId.value : undefined,
      date: new Date(date.value).toISOString(),
      eta: eta.value ? new Date(eta.value).toISOString() : undefined,
      notes: notes.value.trim() || undefined,
      shippingNoteIds: [...shippingNoteIds.value],
      status: status.value,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier l’expédition' : 'Nouvelle expédition'" wide @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Type</Label>
        <div class="mt-1.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-lg border px-3 py-2 text-sm"
            :class="kind === 'route' ? 'chip-active font-medium' : 'text-muted-foreground'"
            @click="kind = 'route'"
          >
            Tournée
          </button>
          <button
            type="button"
            class="rounded-lg border px-3 py-2 text-sm"
            :class="kind === 'transfer' ? 'chip-active font-medium' : 'text-muted-foreground'"
            @click="kind = 'transfer'"
          >
            Transfert entrepôt
          </button>
        </div>
      </div>
      <div v-if="kind === 'route'">
        <Label>Tournée liée</Label>
        <select v-model="routeId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="route in routes" :key="route.id" :value="route.id">{{ route.name }}</option>
        </select>
        <p class="mt-1.5 text-xs text-muted-foreground">Les bons des arrêts de la tournée sont proposés en premier.</p>
      </div>
      <div>
        <Label>Entrepôt d’origine</Label>
        <select v-model="originWarehouseId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
      </div>
      <div v-if="kind === 'transfer'">
        <Label>Entrepôt destinataire</Label>
        <select v-model="destinationWarehouseId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option
            v-for="warehouse in warehouses"
            :key="warehouse.id"
            :value="warehouse.id"
            :disabled="warehouse.id === originWarehouseId"
          >
            {{ warehouse.name }}
          </option>
        </select>
      </div>
      <div v-else>
        <Label>Destination</Label>
        <Input v-model="destination" class="mt-1.5" placeholder="Tournée Casa centre" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
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
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Départ</Label>
          <Input v-model="date" type="datetime-local" class="mt-1.5" />
        </div>
        <div>
          <Label>ETA</Label>
          <Input v-model="eta" type="datetime-local" class="mt-1.5" />
        </div>
      </div>
      <div v-if="editing">
        <Label>Statut</Label>
        <select v-model="status" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="item in statuses" :key="item" :value="item">{{ SHIPMENT_LABEL[item] }}</option>
        </select>
      </div>
      <div>
        <Label>Note</Label>
        <Textarea v-model="notes" class="mt-1.5" :rows="2" />
      </div>
      <section>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Bons de livraison</h3>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">Sélectionnez les bons préparés à embarquer, un point à la fois.</p>
        <div class="mt-2 flex gap-2">
          <select v-model="pickerId" class="h-10 min-w-0 flex-1 rounded-lg border bg-card px-2 text-sm">
            <option value="">Ajouter un bon</option>
            <option v-for="note in pickerOptions" :key="note.id" :value="note.id">{{ shippingNoteLabel(note) }}</option>
          </select>
          <Button size="sm" variant="outline" :disabled="!pickerId" @click="addNote">
            <Plus class="size-3.5" />
            Ajouter
          </Button>
        </div>
        <p v-if="!statusesReady && !selectedNotes.length" class="mt-1.5 text-xs text-amber-700">
          Aucun bon disponible pour cet entrepôt.
        </p>
        <div class="mt-3 space-y-2">
          <div v-for="note in selectedNotes" :key="note.id" class="relative">
            <ShippingNotePreview :note="note" />
            <Button
              size="icon"
              variant="destructive"
              class="absolute right-1 top-1"
              @click="removeNote(note.id)"
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">Enregistrer</Button>
    </template>
  </Sheet>
</template>
