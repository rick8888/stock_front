<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import type { Product, StockMovementType, StockOverviewRow, Warehouse } from '@/types'

const props = defineProps<{
  open: boolean
  kind: StockMovementType
  row: StockOverviewRow | null
  warehouses: Warehouse[]
  products: Product[]
  error?: string | null
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { type: StockMovementType; productId: string; warehouseId: string; quantity: number; note: string; toWarehouseId?: string }]
}>()

const titles: Record<StockMovementType, string> = {
  receive: 'Réceptionner',
  issue: 'Sortir du stock',
  transfer: 'Transférer',
  adjust: 'Ajuster',
  return: 'Retourner en stock',
}

const productId = ref('')
const warehouseId = ref('')
const toWarehouseId = ref('')
const quantity = ref('1')
const note = ref('')

const targets = computed(() => props.warehouses.filter((item) => item.id !== warehouseId.value))
const product = computed(() => props.products.find((item) => item.id === productId.value))
const available = computed(() => {
  if (props.row && props.row.productId === productId.value && props.row.warehouseId === warehouseId.value) {
    return props.row.available
  }
  return Infinity
})
const qty = computed(() => Number(quantity.value) || 0)
const canSubmit = computed(() => {
  if (!productId.value || !warehouseId.value || qty.value <= 0) return false
  if (props.kind === 'transfer' && !toWarehouseId.value) return false
  if (props.kind === 'issue' && qty.value > available.value) return false
  if (props.kind === 'adjust' && !note.value.trim()) return false
  return true
})

watch(
  () => [props.open, props.row?.id, props.kind] as const,
  ([open]) => {
    if (!open) return
    productId.value = props.row?.productId ?? props.products[0]?.id ?? ''
    warehouseId.value = props.row?.warehouseId ?? props.warehouses[0]?.id ?? ''
    toWarehouseId.value = props.warehouses.find((item) => item.id !== warehouseId.value)?.id ?? ''
    quantity.value = props.kind === 'adjust' ? '0' : '1'
    note.value =
      props.kind === 'receive'
        ? 'Réception magasin'
        : props.kind === 'issue'
          ? 'Sortie magasin'
          : props.kind === 'transfer'
            ? 'Transfert entre sites'
            : props.kind === 'return'
              ? 'Retour livraison'
              : ''
  },
)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    type: props.kind,
    productId: productId.value,
    warehouseId: warehouseId.value,
    quantity: props.kind === 'adjust' ? qty.value : qty.value,
    note: note.value.trim(),
    toWarehouseId: props.kind === 'transfer' ? toWarehouseId.value : undefined,
  })
}
</script>

<template>
  <Sheet :open="open" :title="titles[kind]" @close="emit('close')">
    <div class="space-y-4">
      <p v-if="kind === 'transfer'" class="text-xs text-muted-foreground">
        Transfert inter-sites uniquement. Une entrée passe par un BR, une sortie par un BL ou une DA interne.
      </p>
      <div v-if="!row">
        <Label>Article</Label>
        <select v-model="productId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
          <option v-for="item in products" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>
      <p v-else class="text-sm text-muted-foreground">{{ row.productName }} · {{ row.warehouseName }}</p>
      <div v-if="!row">
        <Label>Entrepôt</Label>
        <select v-model="warehouseId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
          <option v-for="item in warehouses" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>
      <div v-if="kind === 'transfer'">
        <Label>Vers</Label>
        <select v-model="toWarehouseId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
          <option v-for="item in targets" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>
      <div>
        <Label>{{ kind === 'adjust' ? 'Écart (+ ou −)' : 'Quantité' }}</Label>
        <Input v-model="quantity" class="mt-1.5" type="number" :step="kind === 'adjust' ? '1' : '1'" />
        <p v-if="kind === 'issue' && available !== Infinity" class="mt-1 text-xs text-muted-foreground">
          Disponible : {{ available }} {{ product?.unit ?? row?.unit }}s
        </p>
      </div>
      <div>
        <Label>Motif</Label>
        <Input v-model="note" class="mt-1.5" :placeholder="kind === 'adjust' ? 'Casse, inventaire, erreur…' : 'Référence ou motif'" />
      </div>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">Valider</Button>
    </template>
  </Sheet>
</template>
