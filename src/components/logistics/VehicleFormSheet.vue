<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { VEHICLE_LABEL } from '@/config/logistics'
import type { Driver, Vehicle, VehicleStatus, Warehouse } from '@/types'
import type { VehicleInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  vehicle?: Vehicle | null
  warehouses: Warehouse[]
  drivers: { id: string; name: string }[]
  assignments: Driver[]
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: VehicleInput }]
}>()

const name = ref('')
const plate = ref('')
const warehouseId = ref('')
const status = ref<VehicleStatus>('available')
const driverId = ref('')

const editing = computed(() => Boolean(props.vehicle))
const canSubmit = computed(() => name.value.trim().length > 1 && plate.value.trim().length > 2 && warehouseId.value)
const statuses: VehicleStatus[] = ['available', 'on_mission', 'maintenance']

function reset() {
  const current = props.vehicle
  name.value = current?.name ?? ''
  plate.value = current?.plate ?? ''
  warehouseId.value = current?.warehouseId ?? props.warehouses[0]?.id ?? ''
  status.value = current?.status ?? 'available'
  driverId.value = current ? props.assignments.find((item) => item.vehicleId === current.id)?.id ?? '' : ''
}

watch(
  () => [props.open, props.vehicle?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.vehicle?.id,
    input: {
      name: name.value.trim(),
      plate: plate.value.trim(),
      warehouseId: warehouseId.value,
      status: status.value,
      driverId: driverId.value || undefined,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier le véhicule' : 'Nouveau véhicule'" @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Nom</Label>
        <Input v-model="name" class="mt-1.5" placeholder="Fourgon 18" />
      </div>
      <div>
        <Label>Immatriculation</Label>
        <Input v-model="plate" class="mt-1.5" placeholder="A 45821" />
      </div>
      <div>
        <Label>Entrepôt</Label>
        <select v-model="warehouseId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
      </div>
      <div>
        <Label>Statut</Label>
        <select v-model="status" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="item in statuses" :key="item" :value="item">{{ VEHICLE_LABEL[item] }}</option>
        </select>
      </div>
      <div>
        <Label>Chauffeur affecté</Label>
        <select v-model="driverId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option value="">Aucun</option>
          <option v-for="driver in drivers" :key="driver.id" :value="driver.id">{{ driver.name }}</option>
        </select>
        <p class="mt-1.5 text-xs text-muted-foreground">Un véhicule n’est affecté qu’à un chauffeur à la fois.</p>
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">Enregistrer</Button>
    </template>
  </Sheet>
</template>
