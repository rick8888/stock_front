<script setup lang="ts">
import { computed, ref } from 'vue'
import { Banknote, CircleDollarSign, Wallet, Receipt } from 'lucide-vue-next'
import { useFinance } from '@/composables/useWork'
import { useSuppliers } from '@/composables/useSuppliers'
import { usePermissions } from '@/composables/usePermissions'
import { useActionBusy } from '@/composables/useActionBusy'
import PageHeader from '@/components/common/PageHeader.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import SectionCard from '@/components/common/SectionCard.vue'
import Sparkline from '@/components/common/Sparkline.vue'
import BarChart from '@/components/common/BarChart.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import { downloadCsv } from '@/utils/csv'
import { formatCompactMoney, formatDate } from '@/lib/utils'

const { can } = usePermissions()
const { run, isBusy } = useActionBusy()
const { invoices, budgets, expenses, receipts, payInvoice } = useFinance()
const payError = ref('')

function receiptOf(orderId: string) {
  return receipts.value.find((item) => item.purchaseOrderId === orderId)
}

async function onPay(id: string) {
  await run(async () => {
    payError.value = ''
    try {
      await payInvoice(id)
    } catch (err) {
      payError.value = err instanceof Error ? err.message : 'Paiement impossible'
    }
  }, id)
}
const { suppliers } = useSuppliers()

const spent = computed(() => budgets.value.reduce((sum, item) => sum + item.spent, 0))
const allocated = computed(() => budgets.value.reduce((sum, item) => sum + item.allocated, 0))
const paid = computed(() =>
  invoices.value.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0),
)
const remaining = computed(() => Math.max(0, allocated.value - spent.value))
const committed = computed(() =>
  invoices.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0),
)

const kpis = computed(() => [
  {
    label: 'Dépenses du mois',
    value: formatCompactMoney(spent.value),
    hint: 'Achats + logistique',
    spark: '0,22 14,18 28,20 42,14 56,16 70,11 84,13 100,8',
    tone: 'text-emerald-600',
    icon: Banknote,
  },
  {
    label: 'Engagé',
    value: formatCompactMoney(committed.value),
    hint: 'Commandes non soldées',
    spark: '0,16 20,18 40,14 60,20 80,12 100,15',
    tone: 'text-amber-500',
    icon: CircleDollarSign,
  },
  {
    label: 'Payé ce mois',
    value: formatCompactMoney(paid.value),
    hint: 'Règlements',
    spark: '0,24 20,20 40,18 60,12 80,10 100,8',
    tone: 'text-teal-700',
    icon: Receipt,
  },
  {
    label: 'Budget restant',
    value: formatCompactMoney(remaining.value),
    hint: `${formatCompactMoney(allocated.value)} alloués`,
    spark: '0,10 25,12 50,11 75,14 100,13',
    tone: 'text-amber-700',
    icon: Wallet,
  },
])

const breakdown = computed(() => {
  const map = new Map<string, number>()
  expenses.value.forEach((item) => map.set(item.category, (map.get(item.category) ?? 0) + item.amount))
  const total = [...map.values()].reduce((sum, value) => sum + value, 0) || 1
  const colors = ['#2D6A4F', '#E0A21A', '#111111', '#3D7A8C']
  return [...map.entries()].map(([label, amount], index) => ({
    label,
    amount,
    pct: Math.round((amount / total) * 100),
    color: colors[index % colors.length],
  }))
})

const donut = computed(() => {
  let start = 0
  return breakdown.value
    .map((item) => {
      const from = start
      start += item.pct * 3.6
      return `${item.color} ${from}deg ${start}deg`
    })
    .join(', ')
})

const bars = computed(() => {
  const max = Math.max(...breakdown.value.map((item) => item.amount), 1)
  return breakdown.value.map((item) => ({
    label: item.label,
    value: Math.round((item.amount / max) * 100),
    color: item.color,
  }))
})

function supplierName(id: string) {
  return suppliers.value.find((item) => item.id === id)?.name ?? id
}

const topSuppliers = computed(() => {
  const totals = new Map<string, number>()
  invoices.value.forEach((invoice) => {
    totals.set(invoice.supplierId, (totals.get(invoice.supplierId) ?? 0) + invoice.amount)
  })
  return [...totals.entries()]
    .map(([id, amount]) => ({
      name: supplierName(id),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
})

const latestInvoices = computed(() => invoices.value.slice(0, 6))

function exportLedger() {
  downloadCsv(
    'export-comptable-factures',
    ['Facture', 'Fournisseur', 'Commande', 'BR', 'Montant MAD', 'Échéance', 'Statut', 'Réception'],
    invoices.value.map((invoice) => {
      const receipt = receiptOf(invoice.purchaseOrderId)
      return [
        invoice.id.toUpperCase(),
        supplierName(invoice.supplierId),
        invoice.purchaseOrderId,
        receipt?.code ?? '',
        invoice.amount,
        invoice.dueDate,
        invoice.status,
        receipt?.status === 'validated' ? 'BR validé' : receipt ? receipt.status : 'Sans BR',
      ]
    }),
  )
}
</script>

<template>
  <div class="page-wide">
    <PageHeader title="Vue financière" description="Dépenses, engagements et paiements du mois.">
      <template #actions>
        <Button v-if="can('finance.view')" size="sm" variant="outline" :disabled="!invoices.length" @click="exportLedger">
          Export comptable
        </Button>
      </template>
    </PageHeader>
    <ErrorState v-if="!can('finance.view')" message="Accès finance restreint." />
    <div v-else class="space-y-5">
      <div class="metric-strip sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="kpi in kpis" :key="kpi.label" class="metric-item">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="metric-label">{{ kpi.label }}</p>
              <p class="metric-value tabular-nums">{{ kpi.value }}</p>
            </div>
            <Sparkline :points="kpi.spark" :class="kpi.tone" />
          </div>
          <p class="text-[11px] text-muted-foreground">{{ kpi.hint }}</p>
        </article>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Répartition des dépenses">
          <div class="flex flex-col items-center gap-6 sm:flex-row">
            <div class="relative size-40 shrink-0 rounded-full" :style="{ background: `conic-gradient(${donut})` }">
              <div class="absolute inset-8 rounded-full bg-card shadow-inner" />
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <p class="text-[11px] text-muted-foreground">Total</p>
                <p class="text-sm font-semibold">{{ formatCompactMoney(spent) }}</p>
              </div>
            </div>
            <ul class="w-full space-y-2.5 text-sm">
              <li v-for="item in breakdown" :key="item.label" class="flex items-center gap-2">
                <span class="size-2.5 rounded-full" :style="{ background: item.color }" />
                <span class="text-muted-foreground">{{ item.label }}</span>
                <span class="ml-auto font-medium">{{ item.pct }}%</span>
              </li>
            </ul>
          </div>
        </SectionCard>
        <SectionCard title="Dépenses par catégorie">
          <BarChart :bars="bars" />
        </SectionCard>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Dernières factures">
          <p v-if="payError" class="mb-2 text-sm text-destructive">{{ payError }}</p>
          <div class="divide-y">
            <article v-for="invoice in latestInvoices" :key="invoice.id" class="flex items-center justify-between gap-3 py-3">
              <div>
                <p class="text-sm font-medium">{{ supplierName(invoice.supplierId) }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ invoice.id.toUpperCase() }} · {{ formatCompactMoney(invoice.amount) }} · {{ formatDate(invoice.dueDate) }}
                </p>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  {{
                    receiptOf(invoice.purchaseOrderId)?.status === 'validated'
                      ? 'Réception validée'
                      : receiptOf(invoice.purchaseOrderId)
                        ? 'Réception en attente'
                        : 'Pas de réception'
                  }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <Badge :variant="invoice.status === 'overdue' ? 'critical' : invoice.status === 'paid' ? 'success' : 'warning'">
                  {{ invoice.status === 'paid' ? 'Payée' : invoice.status === 'overdue' ? 'En retard' : 'En attente' }}
                </Badge>
                <Button v-if="invoice.status !== 'paid' && can('finance.payment')" size="sm" :loading="isBusy(invoice.id)" @click="onPay(invoice.id)">
                  Payer
                </Button>
              </div>
            </article>
          </div>
        </SectionCard>
        <SectionCard title="Top fournisseurs">
          <ol class="space-y-3">
            <li v-for="(supplier, index) in topSuppliers" :key="supplier.name" class="flex items-center gap-3">
              <span class="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {{ index + 1 }}
              </span>
              <span class="flex-1 text-sm font-medium">{{ supplier.name }}</span>
              <span class="text-sm text-muted-foreground">{{ formatCompactMoney(supplier.amount) }}</span>
            </li>
          </ol>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
