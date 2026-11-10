<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Label from '@/components/ui/Label.vue'
import type { Category, InventoryScope, Warehouse, WarehouseLocation } from '@/types'
import { inventoryModeFromScope, inventoryScopeLabel, normalizeInventoryScope } from '@/utils/inventoryScope'

const props = defineProps<{
  open: boolean
  warehouse: Warehouse | null
  categories: Category[]
  locations: WarehouseLocation[]
}>()

const emit = defineEmits<{
  close: []
  start: [payload: { warehouseId: string; scope?: InventoryScope }]
}>()

const mode = ref<'full' | 'partial'>('full')
const categoryId = ref('')
const aisle = ref('')
const locationId = ref('')

watch(
  () => [props.open, props.warehouse?.id] as const,
  ([open]) => {
    if (!open) return
    mode.value = 'full'
    categoryId.value = ''
    aisle.value = ''
    locationId.value = ''
  },
)

const warehouseLocations = computed(() =>
  props.locations.filter((item) => item.warehouseId === props.warehouse?.id && item.active !== false),
)

const aisles = computed(() =>
  [...new Set(warehouseLocations.value.map((item) => item.aisle).filter(Boolean))].sort(),
)

const locationsForAisle = computed(() =>
  warehouseLocations.value.filter((item) => !aisle.value || item.aisle === aisle.value),
)

watch(aisle, () => {
  if (locationId.value && !locationsForAisle.value.some((item) => item.id === locationId.value)) {
    locationId.value = ''
  }
})

const draftScope = computed(() => {
  if (mode.value === 'full') return undefined
  return normalizeInventoryScope({
    categoryId: categoryId.value || undefined,
    aisle: aisle.value || undefined,
    locationId: locationId.value || undefined,
  })
})

const previewLabel = computed(() =>
  inventoryScopeLabel(draftScope.value, {
    categories: props.categories,
    locations: props.locations,
  }),
)

const canStartPartial = computed(
  () => mode.value === 'full' || Boolean(draftScope.value),
)

function submit() {
  if (!props.warehouse || !canStartPartial.value) return
  emit('start', {
    warehouseId: props.warehouse.id,
    scope: mode.value === 'partial' ? draftScope.value : undefined,
  })
}
</script>

<template>
  <Sheet :open="open && !!warehouse" :title="`Démarrer · ${warehouse?.name ?? ''}`" @close="emit('close')">
    <div v-if="warehouse" class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Inventaire complet ou cycle count ciblé (catégorie, allée, emplacement).
      </p>

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
          :class="mode === 'full' ? 'border-foreground bg-muted/50 font-medium' : 'border-border hover:bg-muted/30'"
          @click="mode = 'full'"
        >
          Complet
          <span class="mt-0.5 block text-[11px] font-normal text-muted-foreground">Tout l’entrepôt</span>
        </button>
        <button
          type="button"
          class="rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
          :class="mode === 'partial' ? 'border-foreground bg-muted/50 font-medium' : 'border-border hover:bg-muted/30'"
          @click="mode = 'partial'"
        >
          Cycle count
          <span class="mt-0.5 block text-[11px] font-normal text-muted-foreground">Périmètre ciblé</span>
        </button>
      </div>

      <div v-if="mode === 'partial'" class="space-y-3">
        <div>
          <Label>Catégorie</Label>
          <select v-model="categoryId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
            <option value="">Toutes</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </div>
        <div>
          <Label>Allée</Label>
          <select v-model="aisle" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
            <option value="">Toutes</option>
            <option v-for="item in aisles" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <div>
          <Label>Emplacement</Label>
          <select v-model="locationId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
            <option value="">Tous</option>
            <option v-for="item in locationsForAisle" :key="item.id" :value="item.id">
              {{ item.code }} · {{ item.type }}
            </option>
          </select>
        </div>
        <p v-if="!canStartPartial" class="text-sm text-destructive">
          Choisissez au moins une catégorie, une allée ou un emplacement.
        </p>
        <p v-else class="text-xs text-muted-foreground">Périmètre : {{ previewLabel }}</p>
      </div>

      <Button class="w-full" :disabled="!canStartPartial" @click="submit">
        {{ inventoryModeFromScope(draftScope) === 'partial' ? 'Démarrer le cycle count' : 'Démarrer l’inventaire' }}
      </Button>
    </div>
  </Sheet>
</template>
