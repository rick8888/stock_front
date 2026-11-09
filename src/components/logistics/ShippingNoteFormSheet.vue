<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import type { Product, ShippingNote, Warehouse } from '@/types'
import type { ShippingNoteInput } from '@/repositories/interfaces'

interface FormLine {
  key: string
  productId: string
  quantity: string
}

const props = defineProps<{
  open: boolean
  note?: ShippingNote | null
  warehouses: Warehouse[]
  products: Product[]
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: ShippingNoteInput }]
}>()

const warehouseId = ref('')
const client = ref('')
const address = ref('')
const city = ref('')
const notes = ref('')
const lines = ref<FormLine[]>([blankLine()])

const editing = computed(() => Boolean(props.note))
const catalog = computed(() => props.products.filter((item) => !item.archived))
const selectedWarehouse = computed(() => props.warehouses.find((item) => item.id === warehouseId.value))
const parsedLines = computed(() =>
  lines.value
    .map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }))
    .filter((line) => line.productId && line.quantity > 0),
)
const canSubmit = computed(
  () =>
    warehouseId.value &&
    client.value.trim().length > 1 &&
    address.value.trim().length > 1 &&
    city.value.trim().length > 1 &&
    parsedLines.value.length > 0,
)

function blankLine(): FormLine {
  return { key: `ln-${Math.random().toString(36).slice(2, 8)}`, productId: '', quantity: '4' }
}

function reset() {
  const current = props.note
  warehouseId.value = current?.warehouseId ?? props.warehouses[0]?.id ?? ''
  client.value = current?.client ?? ''
  address.value = current?.address ?? ''
  city.value = current?.city ?? props.warehouses.find((item) => item.id === warehouseId.value)?.city ?? ''
  notes.value = current?.notes ?? ''
  const starters = current?.lines.length
    ? current.lines.map((line) => ({
        key: `ln-${line.productId}`,
        productId: line.productId,
        quantity: String(line.quantity),
      }))
    : [blankLine()]
  if (starters[0] && !starters[0].productId && catalog.value[0]) starters[0].productId = catalog.value[0].id
  lines.value = starters
}

watch(
  () => [props.open, props.note?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

watch(warehouseId, (id) => {
  if (props.note) return
  const warehouse = props.warehouses.find((item) => item.id === id)
  if (warehouse && !city.value) city.value = warehouse.city
})

function optionsFor(line: FormLine) {
  const taken = new Set(lines.value.filter((item) => item.key !== line.key).map((item) => item.productId))
  return catalog.value.filter((item) => item.id === line.productId || !taken.has(item.id))
}

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
  if (!canSubmit.value) return
  emit('submit', {
    id: props.note?.id,
    input: {
      warehouseId: warehouseId.value,
      client: client.value.trim(),
      address: address.value.trim(),
      city: city.value.trim(),
      notes: notes.value.trim() || undefined,
      lines: parsedLines.value,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier le bon de livraison' : 'Nouveau bon de livraison'" wide @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Entrepôt de préparation</Label>
        <select v-model="warehouseId" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm" :disabled="editing">
          <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
        </select>
        <p v-if="selectedWarehouse" class="mt-1.5 text-xs text-muted-foreground">
          Le logisticien de cet entrepôt sera notifié dès l’enregistrement.
        </p>
      </div>
      <div>
        <Label>Client</Label>
        <Input v-model="client" class="mt-1.5" placeholder="Pharmacie des Habous" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Adresse</Label>
          <Input v-model="address" class="mt-1.5" placeholder="Quartier des Habous" />
        </div>
        <div>
          <Label>Ville</Label>
          <Input v-model="city" class="mt-1.5" placeholder="Casablanca" />
        </div>
      </div>
      <div>
        <Label>Note interne</Label>
        <Textarea v-model="notes" class="mt-1.5" :rows="2" placeholder="Palette fragile, créneau magasin…" />
      </div>
      <section>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Articles</h3>
          <Button size="sm" variant="outline" :disabled="lines.length >= catalog.length" @click="addLine">
            <Plus class="size-3.5" />
            Ajouter
          </Button>
        </div>
        <div class="mt-2 space-y-2">
          <article v-for="line in lines" :key="line.key" class="rounded-xl border px-3 py-2.5">
            <div class="flex items-start gap-2">
              <select v-model="line.productId" class="h-9 min-w-0 flex-1 rounded-lg border bg-card px-2 text-sm">
                <option value="">Article</option>
                <option v-for="product in optionsFor(line)" :key="product.id" :value="product.id">
                  {{ product.name }}
                </option>
              </select>
              <Input v-model="line.quantity" type="number" min="1" class="h-9 w-20" />
              <Button size="icon" variant="destructive" :disabled="lines.length === 1" @click="removeLine(line.key)">
                <Trash2 class="size-4" />
              </Button>
            </div>
          </article>
        </div>
      </section>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Préparer le bon' }}
      </Button>
    </template>
  </Sheet>
</template>
