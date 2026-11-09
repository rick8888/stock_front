<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { DRIVER_LABEL } from '@/config/logistics'
import type { Driver, User, Vehicle, Warehouse } from '@/types'
import type { DriverInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  driver?: Driver | null
  user?: User | null
  vehicles: Vehicle[]
  warehouses: Warehouse[]
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: DriverInput }]
}>()

const firstName = ref('')
const lastName = ref('')
const phone = ref('')
const email = ref('')
const warehouseId = ref('')
const vehicleId = ref('')
const status = ref<Driver['status']>('available')

const editing = computed(() => Boolean(props.driver))
const canSubmit = computed(
  () => firstName.value.trim().length > 1 && lastName.value.trim().length > 1 && phone.value.trim().length > 6,
)
const statuses: Driver['status'][] = ['available', 'on_route', 'off']

function reset() {
  const current = props.driver
  const user = props.user
  firstName.value = user?.firstName ?? ''
  lastName.value = user?.lastName ?? ''
  phone.value = current?.phone ?? ''
  email.value = user?.email ?? ''
  warehouseId.value = user?.warehouseIds[0] ?? props.warehouses[0]?.id ?? ''
  vehicleId.value = current?.vehicleId ?? ''
  status.value = current?.status ?? 'available'
}

watch(
  () => [props.open, props.driver?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.driver?.id,
    input: {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim() || undefined,
      warehouseId: warehouseId.value || undefined,
      vehicleId: vehicleId.value || undefined,
      status: status.value,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier le chauffeur' : 'Nouveau chauffeur'" @close="emit('close')">
    <div class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Prénom</Label>
          <Input v-model="firstName" class="mt-1.5" placeholder="Mehdi" />
        </div>
        <div>
          <Label>Nom</Label>
          <Input v-model="lastName" class="mt-1.5" placeholder="Chraibi" />
        </div>
      </div>
      <div>
        <Label>Téléphone</Label>
        <Input v-model="phone" class="mt-1.5" placeholder="+212 661 00 00 00" />
      </div>
      <div>
        <Label>Email</Label>
        <Input v-model="email" class="mt-1.5" placeholder="mehdi.chraibi@bravo.stock" />
        <p class="mt-1.5 text-xs text-muted-foreground">Laissé vide, un email de connexion est généré. Mot de passe : demo.</p>
      </div>
      <div>
        <Label>Entrepôt</Label>
        <select v-model="warehouseId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
      </div>
      <div>
        <Label>Véhicule affecté</Label>
        <select v-model="vehicleId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option value="">Aucun</option>
          <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
            {{ vehicle.name }} · {{ vehicle.plate }}
          </option>
        </select>
      </div>
      <div v-if="editing">
        <Label>Statut</Label>
        <select v-model="status" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option v-for="item in statuses" :key="item" :value="item">{{ DRIVER_LABEL[item] }}</option>
        </select>
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">Enregistrer</Button>
    </template>
  </Sheet>
</template>
