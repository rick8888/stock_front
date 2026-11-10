<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Switch from '@/components/ui/Switch.vue'
import type { LocationType, Warehouse, WarehouseLocation } from '@/types'
import type { WarehouseLocationInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  location?: WarehouseLocation | null
  warehouses: Warehouse[]
  defaultWarehouseId?: string
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: WarehouseLocationInput }]
}>()

const warehouseId = ref('')
const aisle = ref('A')
const rack = ref('01')
const bin = ref('01')
const type = ref<LocationType>('pick')
const active = ref(true)

const editing = computed(() => Boolean(props.location))
const preview = computed(() => `${aisle.value}-${rack.value}-${bin.value}`.toUpperCase())
const canSubmit = computed(() => warehouseId.value && aisle.value.trim() && rack.value.trim() && bin.value.trim())

function reset() {
  const current = props.location
  warehouseId.value = current?.warehouseId ?? props.defaultWarehouseId ?? props.warehouses[0]?.id ?? ''
  aisle.value = current?.aisle ?? 'A'
  rack.value = current?.rack ?? '01'
  bin.value = current?.bin ?? '01'
  type.value = current?.type ?? 'pick'
  active.value = current?.active ?? true
}

watch(
  () => [props.open, props.location?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.location?.id,
    input: {
      warehouseId: warehouseId.value,
      aisle: aisle.value.trim(),
      rack: rack.value.trim(),
      bin: bin.value.trim(),
      type: type.value,
      active: active.value,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier l’emplacement' : 'Nouvel emplacement'" @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Entrepôt</Label>
        <select v-model="warehouseId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm" :disabled="editing">
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <Label>Allée</Label>
          <Input v-model="aisle" class="mt-1.5" placeholder="A" />
        </div>
        <div>
          <Label>Rack</Label>
          <Input v-model="rack" class="mt-1.5" placeholder="01" />
        </div>
        <div>
          <Label>Bac</Label>
          <Input v-model="bin" class="mt-1.5" placeholder="01" />
        </div>
      </div>
      <p class="text-xs text-muted-foreground">Code : <span class="font-medium text-foreground">{{ preview }}</span></p>
      <div>
        <Label>Type</Label>
        <select v-model="type" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option value="pick">Picking</option>
          <option value="bulk">Réserve / bulk</option>
          <option value="staging">Staging</option>
        </select>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
        <div>
          <p class="text-sm font-medium">Actif</p>
          <p class="text-xs text-muted-foreground">Disponible pour putaway et picking.</p>
        </div>
        <Switch :checked="active" @update:checked="active = $event" />
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer' }}
      </Button>
    </template>
  </Sheet>
</template>
