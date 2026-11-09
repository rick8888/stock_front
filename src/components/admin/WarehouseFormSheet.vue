<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MapPin } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Switch from '@/components/ui/Switch.vue'
import { searchPlaces, type PlaceSuggestion } from '@/mocks/places'
import type { User, Warehouse } from '@/types'

const REGIONS = [
  { id: 'reg-nord', name: 'Nord' },
  { id: 'reg-centre', name: 'Centre' },
]

const props = defineProps<{
  open: boolean
  managers: User[]
}>()

const emit = defineEmits<{
  close: []
  submit: [input: Omit<Warehouse, 'id'>]
}>()

const name = ref('')
const city = ref('')
const address = ref('')
const regionId = ref('reg-nord')
const managerUserId = ref('')
const capacity = ref('4000')
const active = ref(true)
const lat = ref<number | undefined>()
const lng = ref<number | undefined>()
const query = ref('')
const listOpen = ref(false)
const picked = ref<PlaceSuggestion | null>(null)

const suggestions = computed(() => searchPlaces(query.value))

const canSubmit = computed(
  () =>
    name.value.trim().length > 1 &&
    city.value.trim().length > 1 &&
    address.value.trim().length > 2 &&
    regionId.value &&
    managerUserId.value &&
    Number(capacity.value) > 0,
)

function reset() {
  name.value = ''
  city.value = ''
  address.value = ''
  regionId.value = 'reg-nord'
  managerUserId.value = props.managers[0]?.id ?? ''
  capacity.value = '4000'
  active.value = true
  lat.value = undefined
  lng.value = undefined
  query.value = ''
  listOpen.value = false
  picked.value = null
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function onQuery() {
  picked.value = null
  address.value = query.value.trim()
  listOpen.value = query.value.trim().length >= 2
}

function pick(place: PlaceSuggestion) {
  picked.value = place
  query.value = `${place.label}, ${place.secondary}`
  address.value = place.address
  city.value = place.city
  regionId.value = place.regionId
  lat.value = place.lat
  lng.value = place.lng
  listOpen.value = false
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    name: name.value.trim(),
    city: city.value.trim(),
    address: address.value.trim(),
    regionId: regionId.value,
    managerUserId: managerUserId.value,
    capacity: Math.round(Number(capacity.value)),
    active: active.value,
    lat: lat.value,
    lng: lng.value,
  })
}
</script>

<template>
  <Sheet :open="open" title="Nouvel entrepôt" @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Nom</Label>
        <Input v-model="name" class="mt-1.5" placeholder="Casablanca nord" />
      </div>
      <div class="relative">
        <Label>Adresse</Label>
        <div class="relative mt-1.5">
          <MapPin class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="query"
            class="pl-9"
            placeholder="Rechercher une adresse"
            autocomplete="off"
            @update:model-value="onQuery"
            @focus="listOpen = query.trim().length >= 2"
            @blur="listOpen = false"
          />
        </div>
        <ul
          v-if="listOpen && suggestions.length"
          class="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-card py-1 shadow-soft"
        >
          <li v-for="place in suggestions" :key="place.id">
            <button
              type="button"
              class="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-muted"
              @mousedown.prevent="pick(place)"
            >
              <MapPin class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0">
                <span class="block text-sm font-medium">{{ place.label }}</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">{{ place.secondary }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else-if="listOpen && query.trim().length >= 2" class="mt-1.5 text-xs text-muted-foreground">
          Aucune suggestion. L’adresse saisie sera utilisée telle quelle.
        </p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Ville</Label>
          <Input v-model="city" class="mt-1.5" placeholder="Casablanca" />
        </div>
        <div>
          <Label>Région</Label>
          <select v-model="regionId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
            <option v-for="region in REGIONS" :key="region.id" :value="region.id">{{ region.name }}</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Gestionnaire</Label>
        <select v-model="managerUserId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
          <option v-for="manager in managers" :key="manager.id" :value="manager.id">
            {{ manager.firstName }} {{ manager.lastName }}
          </option>
        </select>
      </div>
      <div>
        <Label>Capacité (m²)</Label>
        <Input v-model="capacity" class="mt-1.5" type="number" placeholder="4000" />
      </div>
      <div class="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
        <div>
          <p class="text-sm font-medium">Site actif</p>
          <p class="text-xs text-muted-foreground">Disponible pour le stock et les tournées.</p>
        </div>
        <Switch :checked="active" @update:checked="active = $event" />
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">Créer</Button>
    </template>
  </Sheet>
</template>
