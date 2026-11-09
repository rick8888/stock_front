<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { formatMoney } from '@/lib/utils'
import type { Product, RequestPriority, Warehouse } from '@/types'

interface FormLine {
  key: string
  productId: string
  quantity: string
}

const props = defineProps<{
  open: boolean
  products: Product[]
  warehouses: Warehouse[]
  title?: string
  lockWarehouse?: boolean
  initialWarehouseId?: string
  initialNote?: string
  initialLines?: { productId: string; quantity: number }[]
}>()

const emit = defineEmits<{
  close: []
  submit: [
    payload: {
      warehouseId: string
      items: { productId: string; quantity: number }[]
      note: string
      priority: RequestPriority
      asDraft: boolean
    },
  ]
}>()

const warehouseId = ref('wh-casa')
const note = ref('')
const priority = ref<RequestPriority>('high')
const asDraft = ref(false)
const lines = ref<FormLine[]>([blankLine()])

function blankLine(): FormLine {
  return { key: `ln-${Math.random().toString(36).slice(2, 8)}`, productId: '', quantity: '1' }
}

function reset() {
  warehouseId.value = props.initialWarehouseId || props.warehouses[0]?.id || 'wh-casa'
  note.value = props.initialNote ?? ''
  priority.value = 'high'
  asDraft.value = false
  const starters = props.initialLines?.length
    ? props.initialLines.map((item) => ({
        key: `ln-${item.productId}`,
        productId: item.productId,
        quantity: String(item.quantity),
      }))
    : [blankLine()]
  if (starters[0] && !starters[0].productId && props.products[0]) {
    starters[0].productId = props.products[0].id
  }
  lines.value = starters
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

const catalog = computed(() => props.products.filter((item) => !item.archived))

function optionsFor(line: FormLine) {
  const taken = new Set(lines.value.filter((item) => item.key !== line.key).map((item) => item.productId))
  return catalog.value.filter((item) => item.id === line.productId || !taken.has(item.id))
}

function productOf(id: string) {
  return catalog.value.find((item) => item.id === id)
}

const parsedItems = computed(() =>
  lines.value
    .map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }))
    .filter((line) => line.productId && line.quantity > 0),
)

const estimated = computed(() =>
  parsedItems.value.reduce((sum, line) => sum + (productOf(line.productId)?.price ?? 0) * line.quantity, 0),
)

function addLine() {
  const next = catalog.value.find((item) => !lines.value.some((line) => line.productId === item.id))
  const line = blankLine()
  if (next) line.productId = next.id
  lines.value.push(line)
}

function removeLine(key: string) {
  if (lines.value.length === 1) return
  lines.value = lines.value.filter((item) => item.key !== key)
}

function submit() {
  if (!parsedItems.value.length) return
  emit('submit', {
    warehouseId: warehouseId.value,
    items: parsedItems.value,
    note: note.value,
    priority: priority.value,
    asDraft: asDraft.value,
  })
}
</script>

<template>
  <Sheet :open="open" :title="title ?? 'Nouvelle demande d’achat'" wide @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Entrepôt</Label>
        <select
          v-model="warehouseId"
          class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm disabled:opacity-70"
          :disabled="lockWarehouse"
        >
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
      </div>

      <section>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Articles</h3>
          <Button
            size="sm"
            variant="outline"
            :disabled="lines.length >= catalog.length"
            @click="addLine"
          >
            <Plus class="size-3.5" />
            Ajouter
          </Button>
        </div>
        <div class="mt-2 space-y-2">
          <article v-for="line in lines" :key="line.key" class="rounded-xl border px-3 py-2.5">
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1 space-y-2">
                <select v-model="line.productId" class="h-10 w-full rounded-lg border bg-card px-3 text-sm">
                  <option value="" disabled>Choisir un produit</option>
                  <option v-for="product in optionsFor(line)" :key="product.id" :value="product.id">
                    {{ product.name }}
                  </option>
                </select>
                <div class="flex items-center gap-2">
                  <Input v-model="line.quantity" type="number" min="1" class="flex-1" />
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {{ productOf(line.productId)?.unit ?? 'unité' }}s
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="mt-2 rounded-md bg-destructive p-1.5 text-destructive-foreground hover:bg-destructive/90 disabled:opacity-30"
                :disabled="lines.length === 1"
                aria-label="Retirer l’article"
                @click="removeLine(line.key)"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
          </article>
        </div>
        <p class="mt-2 text-right text-sm font-semibold">Total estimé {{ formatMoney(estimated) }}</p>
      </section>

      <div>
        <Label>Priorité</Label>
        <select v-model="priority" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
          <option value="high">Haute</option>
          <option value="medium">Moyenne</option>
          <option value="low">Basse</option>
        </select>
      </div>
      <div>
        <Label>Motif</Label>
        <Input v-model="note" class="mt-1.5" placeholder="Pourquoi ce besoin ?" />
      </div>
      <label class="flex items-center gap-2 text-sm text-muted-foreground">
        <input v-model="asDraft" type="checkbox" class="size-4 rounded border-input" />
        Enregistrer en brouillon
      </label>
      <Button class="w-full" :disabled="!parsedItems.length" @click="submit">
        {{ asDraft ? 'Enregistrer' : 'Soumettre' }}
      </Button>
    </div>
  </Sheet>
</template>
