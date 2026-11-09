<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Dialog from '@/components/ui/Dialog.vue'
import { useUiStore } from '@/stores/ui'
import { useProducts } from '@/composables/useProducts'
import { useSuppliers } from '@/composables/useSuppliers'
import { usePurchaseOrders } from '@/composables/useProcurement'
import { useDeliveries, useShippingNotes } from '@/composables/useLogistics'

const ui = useUiStore()
const router = useRouter()
const query = ref('')
const { products } = useProducts()
const { suppliers } = useSuppliers()
const { orders } = usePurchaseOrders()
const { deliveries } = useDeliveries()
const { shippingNotes } = useShippingNotes()

const results = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return []
  return [
    ...products.value
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        label: item.name,
        hint: item.sku,
        to: { path: '/stock', query: { article: item.id } },
      })),
    ...suppliers.value
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        label: item.name,
        hint: 'Fournisseur',
        to: { path: '/procurement', query: { tab: 'suppliers', supplier: item.id } },
      })),
    ...orders.value
      .filter((item) => item.id.toLowerCase().includes(q) || (item.code ?? '').toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        label: (item.code ?? item.id).toUpperCase(),
        hint: 'Commande',
        to: { path: '/procurement', query: { tab: 'orders', order: item.id } },
      })),
    ...shippingNotes.value
      .filter(
        (item) =>
          item.client.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q),
      )
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        label: item.code,
        hint: item.client,
        to: { path: '/logistics', query: { tab: 'notes', note: item.id } },
      })),
    ...deliveries.value
      .filter((item) => item.client.toLowerCase().includes(q) || item.id.includes(q))
      .slice(0, 3)
      .map((item) => ({
        id: `dlv-${item.id}`,
        label: item.client,
        hint: 'Livraison',
        to: { path: '/logistics', query: { tab: 'deliveries', delivery: item.id } },
      })),
  ]
})

function onKey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    ui.commandOpen = !ui.commandOpen
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

async function go(to: (typeof results.value)[number]['to']) {
  ui.commandOpen = false
  query.value = ''
  await router.push(to)
}

async function goFirst() {
  if (results.value[0]) {
    await go(results.value[0].to)
    return
  }
}
</script>

<template>
  <Dialog :open="ui.commandOpen" title="Recherche" @close="ui.commandOpen = false">
    <input
      v-model="query"
      class="field mb-2"
      placeholder="Article, commande, BL, client…"
      @keydown.enter="goFirst"
    />
    <div class="space-y-0.5">
      <p v-if="query.trim() && !results.length" class="px-2 py-2 text-[13px] text-muted-foreground">Aucun résultat.</p>
      <button
        v-for="item in results"
        :key="item.id"
        class="flex w-full items-center justify-between rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-muted"
        @click="go(item.to)"
      >
        <span>{{ item.label }}</span>
        <span class="text-[11px] text-muted-foreground">{{ item.hint }}</span>
      </button>
    </div>
  </Dialog>
</template>
