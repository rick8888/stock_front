<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/Badge.vue'
import { formatDateTime } from '@/lib/utils'
import type { InventorySession, Product } from '@/types'

const props = defineProps<{
  open: boolean
  session: InventorySession | null
  products: Product[]
  warehouseName?: string
  error?: string | null
  canCount?: boolean
  canApprove?: boolean
  countedByName?: string
}>()

const emit = defineEmits<{
  close: []
  save: [lines: { productId: string; counted: number }[]]
  submit: [lines: { productId: string; counted: number }[]]
  complete: [lines: { productId: string; counted: number }[]]
}>()

const counts = ref<Record<string, string>>({})

watch(
  () => [props.open, props.session?.id] as const,
  ([open]) => {
    if (!open || !props.session) return
    counts.value = Object.fromEntries(
      (props.session.lines ?? []).map((line) => [line.productId, String(line.counted)]),
    )
  },
)

const readonly = computed(
  () => props.session?.status === 'pending_review' || props.session?.status === 'completed' || !props.canCount,
)

const rows = computed(() =>
  (props.session?.lines ?? []).map((line) => {
    const product = props.products.find((item) => item.id === line.productId)
    const counted = Number(counts.value[line.productId] ?? line.counted) || 0
    return { ...line, counted, product, delta: counted - line.expected }
  }),
)

const gapRows = computed(() => rows.value.filter((item) => item.delta !== 0))
const canCloseWithoutGaps = computed(
  () => props.session?.status === 'in_progress' && props.canCount && !gapRows.value.length,
)
const canSubmitGaps = computed(
  () => props.session?.status === 'in_progress' && props.canCount && gapRows.value.length > 0,
)
const canValidate = computed(() => props.session?.status === 'pending_review' && props.canApprove)

function payload() {
  return rows.value.map((item) => ({ productId: item.productId, counted: item.counted }))
}

function nameOf(id: string) {
  return props.products.find((item) => item.id === id)?.name ?? id
}

function printPv() {
  window.print()
}

const statusLabel = computed(() => {
  if (props.session?.status === 'completed') return 'Clôturé'
  if (props.session?.status === 'pending_review') return 'À valider'
  return 'En cours'
})
</script>

<template>
  <Sheet :open="open && !!session" :title="`Inventaire · ${warehouseName ?? ''}`" wide @close="emit('close')">
    <div v-if="session" class="space-y-3">
      <p class="text-sm text-muted-foreground">
        <template v-if="session.status === 'in_progress'">
          Comptez. S’il y a un écart, soumettez-le : un manager valide avant d’ajuster le stock.
        </template>
        <template v-else-if="session.status === 'pending_review'">
          Vérifiez les écarts ci-dessous, puis validez pour ajuster le stock.
        </template>
        <template v-else>Comptage clôturé. Vous pouvez imprimer le procès-verbal.</template>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <Badge :variant="session.status === 'completed' ? 'success' : session.status === 'pending_review' ? 'warning' : 'info'">
          {{ statusLabel }}
        </Badge>
        <span v-if="countedByName" class="text-xs text-muted-foreground">Compté par {{ countedByName }}</span>
      </div>

      <article v-for="row in rows" :key="row.productId" class="rounded-lg border px-3 py-2.5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium">{{ nameOf(row.productId) }}</p>
            <p class="text-xs text-muted-foreground">Théorique {{ row.expected }}</p>
          </div>
          <Input v-if="!readonly" v-model="counts[row.productId]" class="w-24" type="number" min="0" />
          <p v-else class="text-sm font-semibold">{{ row.counted }}</p>
        </div>
        <p class="mt-1 text-xs" :class="row.delta === 0 ? 'text-muted-foreground' : row.delta < 0 ? 'text-red-700' : 'text-emerald-700'">
          {{ row.delta === 0 ? 'Conforme' : row.delta > 0 ? `+${row.delta}` : row.delta }}
        </p>
      </article>
      <Badge variant="outline">{{ gapRows.length }} écart(s)</Badge>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <div class="print-sheet hidden print:block space-y-3 border-t pt-4">
        <h2 class="text-base font-semibold">Procès-verbal d’inventaire</h2>
        <p class="text-sm">{{ warehouseName }} · {{ formatDateTime(session.startedAt) }}</p>
        <p v-if="countedByName" class="text-sm">Comptage : {{ countedByName }}</p>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left">
              <th class="py-1">Article</th>
              <th class="py-1">Théorique</th>
              <th class="py-1">Compté</th>
              <th class="py-1">Écart</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.productId" class="border-b">
              <td class="py-1">{{ nameOf(row.productId) }}</td>
              <td class="py-1">{{ row.expected }}</td>
              <td class="py-1">{{ row.counted }}</td>
              <td class="py-1">{{ row.delta }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <template #footer>
      <div class="flex flex-wrap gap-2">
        <Button class="flex-1" variant="outline" @click="printPv">Imprimer le PV</Button>
        <Button v-if="session?.status === 'in_progress' && canCount" class="flex-1" variant="outline" @click="emit('save', payload())">
          Enregistrer
        </Button>
        <Button v-if="canSubmitGaps" class="flex-1" @click="emit('submit', payload())">Soumettre les écarts</Button>
        <Button v-if="canCloseWithoutGaps" class="flex-1" @click="emit('complete', payload())">Clôturer</Button>
        <Button v-if="canValidate" class="flex-1" @click="emit('complete', payload())">Valider et ajuster</Button>
      </div>
    </template>
  </Sheet>
</template>
