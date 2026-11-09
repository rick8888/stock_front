<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import type { Product, PurchaseOrder, Receipt } from '@/types'

const props = defineProps<{
  open: boolean
  receipts: Receipt[]
  orders: PurchaseOrder[]
  products: Product[]
  error?: string | null
}>()

const emit = defineEmits<{
  close: []
  ensure: [orderId: string]
  submit: [payload: { receiptId: string; lines: { productId: string; received: number }[] }]
}>()

const receiptId = ref('')
const qty = ref<Record<string, string>>({})

const openOrders = computed(() =>
  props.orders.filter(
    (order) =>
      ['confirmed', 'partial', 'delayed', 'sent'].includes(order.status) &&
      !props.receipts.some((item) => item.purchaseOrderId === order.id),
  ),
)

const current = computed(() => props.receipts.find((item) => item.id === receiptId.value) ?? null)
const lines = computed(() => current.value?.items ?? [])

watch(
  () => [props.open, props.receipts.length] as const,
  ([open]) => {
    if (!open) return
    receiptId.value = props.receipts[0]?.id ?? ''
  },
)

watch(
  current,
  (receipt) => {
    qty.value = Object.fromEntries((receipt?.items ?? []).map((line) => [line.productId, String(line.expected)]))
  },
)

function productName(id: string) {
  return props.products.find((item) => item.id === id)?.name ?? id
}

function submit() {
  if (!current.value) return
  emit('submit', {
    receiptId: current.value.id,
    lines: lines.value.map((line) => ({
      productId: line.productId,
      received: Number(qty.value[line.productId] ?? line.expected) || 0,
    })),
  })
}
</script>

<template>
  <Sheet :open="open" title="Réceptionner une commande" wide @close="emit('close')">
    <div class="space-y-4">
      <div v-if="openOrders.length" class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">Commandes sans bon de réception</p>
        <button
          v-for="order in openOrders"
          :key="order.id"
          class="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
          @click="emit('ensure', order.id)"
        >
          {{ order.code ?? order.id }} · {{ order.status }}
        </button>
      </div>
      <div>
        <Label>Bon de réception</Label>
        <select v-model="receiptId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
          <option v-if="!receipts.length" value="">Aucun arrivage en attente</option>
          <option v-for="item in receipts" :key="item.id" :value="item.id">
            {{ item.code ?? item.id }} · {{ item.status }}
          </option>
        </select>
      </div>
      <article v-for="line in lines" :key="line.productId" class="rounded-lg border px-3 py-2.5">
        <p class="text-sm font-medium">{{ productName(line.productId) }}</p>
        <p class="text-xs text-muted-foreground">Commandé {{ line.expected }} · déjà reçu {{ line.received }}</p>
        <Input v-model="qty[line.productId]" class="mt-2" type="number" min="0" />
      </article>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!current" @click="submit">Mettre en stock</Button>
    </template>
  </Sheet>
</template>
