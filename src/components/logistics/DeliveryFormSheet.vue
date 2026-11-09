<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import ShippingNotePreview from '@/components/logistics/ShippingNotePreview.vue'
import { DEMO_TODAY } from '@/utils/helpers'
import { DELIVERY_LABEL } from '@/config/logistics'
import { availableShippingNotes, shippingNoteLabel } from '@/utils/shippingNotes'
import type { Delivery, DeliveryStatus, Route, ShippingNote } from '@/types'
import type { DeliveryInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  delivery?: Delivery | null
  routes: Route[]
  shippingNotes: ShippingNote[]
  initialRouteId?: string
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: DeliveryInput }]
}>()

const shippingNoteId = ref('')
const scheduledAt = ref(`${DEMO_TODAY}T09:00`)
const routeId = ref('')
const notes = ref('')
const status = ref<DeliveryStatus>('prepared')

const editing = computed(() => Boolean(props.delivery))
const selectedRoute = computed(() => props.routes.find((item) => item.id === routeId.value))
const selectedNote = computed(() => props.shippingNotes.find((item) => item.id === shippingNoteId.value))
const noteOptions = computed(() =>
  availableShippingNotes(props.shippingNotes, {
    warehouseId: selectedRoute.value?.warehouseId,
    keepIds: [shippingNoteId.value],
    excludeAssignedToOtherDelivery: props.delivery?.id ?? '',
  }),
)
const canSubmit = computed(() => Boolean(shippingNoteId.value && routeId.value && scheduledAt.value))

const statuses: DeliveryStatus[] = ['prepared', 'in_transit', 'at_risk', 'delivered', 'failed']

function toLocal(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function reset() {
  const current = props.delivery
  routeId.value = current?.routeId ?? props.initialRouteId ?? props.routes[0]?.id ?? ''
  shippingNoteId.value = current?.shippingNoteId ?? ''
  scheduledAt.value = current?.scheduledAt ? toLocal(current.scheduledAt) : `${DEMO_TODAY}T09:00`
  notes.value = current?.notes ?? ''
  status.value = current?.status ?? 'prepared'
  if (!shippingNoteId.value) {
    shippingNoteId.value = noteOptions.value.find((item) => item.status === 'ready')?.id ?? ''
  }
}

watch(
  () => [props.open, props.delivery?.id, props.initialRouteId] as const,
  ([open]) => {
    if (open) reset()
  },
)

watch(routeId, () => {
  if (!props.open) return
  if (selectedNote.value && selectedRoute.value && selectedNote.value.warehouseId !== selectedRoute.value.warehouseId) {
    shippingNoteId.value = noteOptions.value.find((item) => item.status === 'ready')?.id ?? ''
  }
})

function submit() {
  if (!canSubmit.value || !selectedNote.value) return
  emit('submit', {
    id: props.delivery?.id,
    input: {
      shippingNoteId: shippingNoteId.value,
      client: selectedNote.value.client,
      address: selectedNote.value.address,
      city: selectedNote.value.city,
      scheduledAt: new Date(scheduledAt.value).toISOString(),
      routeId: routeId.value,
      notes: notes.value.trim() || undefined,
      status: status.value,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier la livraison' : 'Nouvelle livraison'" wide @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Tournée</Label>
        <select v-model="routeId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="route in routes" :key="route.id" :value="route.id">{{ route.name }}</option>
        </select>
        <p v-if="selectedRoute" class="mt-1.5 text-xs text-muted-foreground">Chauffeur et véhicule repris de la tournée.</p>
        <p v-if="!routes.length" class="mt-1.5 text-xs text-amber-700">Créez d’abord une tournée.</p>
      </div>
      <div>
        <Label>Bon de livraison</Label>
        <select v-model="shippingNoteId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option value="">Choisir un bon préparé</option>
          <option v-for="note in noteOptions" :key="note.id" :value="note.id">{{ shippingNoteLabel(note) }}</option>
        </select>
        <p class="mt-1.5 text-xs text-muted-foreground">
          Le client, l’adresse et les articles viennent du bon préparé en magasin.
        </p>
        <p v-if="!noteOptions.length" class="mt-1.5 text-xs text-amber-700">
          Aucun bon disponible pour cet entrepôt.
        </p>
      </div>
      <ShippingNotePreview v-if="selectedNote" :note="selectedNote" />
      <div>
        <Label>Créneau</Label>
        <Input v-model="scheduledAt" type="datetime-local" class="mt-1.5" />
      </div>
      <div>
        <Label>Statut</Label>
        <select v-model="status" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="item in statuses" :key="item" :value="item">{{ DELIVERY_LABEL[item] }}</option>
        </select>
      </div>
      <div>
        <Label>Note</Label>
        <Textarea v-model="notes" class="mt-1.5" :rows="2" placeholder="Accès, créneau, consigne…" />
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">Enregistrer</Button>
    </template>
  </Sheet>
</template>
