<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Building2, CreditCard, TriangleAlert, Wallet } from 'lucide-vue-next'
import { usePlatform } from '@/composables/usePlatform'
import { useActionBusy } from '@/composables/useActionBusy'
import { PLAN_MODULES } from '@/mocks/platform'
import PageHeader from '@/components/common/PageHeader.vue'
import SignalCard from '@/components/common/SignalCard.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import CompanyFormSheet from '@/components/platform/CompanyFormSheet.vue'
import PlanFormSheet from '@/components/platform/PlanFormSheet.vue'
import CompanyDetailSheet from '@/components/platform/CompanyDetailSheet.vue'
import { formatDate, formatMoney } from '@/lib/utils'
import type {
  BillingInterval,
  Company,
  CompanyStatus,
  PlatformInvoiceStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/types'
import type { CompanyInput, PlanInput } from '@/repositories/interfaces'

const route = useRoute()
const { run, isBusy } = useActionBusy()
const {
  plans,
  invoices,
  users,
  snapshot,
  rows,
  loading,
  error,
  createCompany,
  updateCompany,
  setCompanyStatus,
  createPlan,
  updatePlan,
  changeSubscription,
  payInvoice,
} = usePlatform()

const tab = computed(() => (typeof route.query.tab === 'string' ? route.query.tab : 'overview'))
const companyFilter = ref<'all' | CompanyStatus>('all')
const invoiceFilter = ref<'all' | PlatformInvoiceStatus>('all')
const companyOpen = ref(false)
const planOpen = ref(false)
const detailOpen = ref(false)
const editingCompany = ref<Company | null>(null)
const editingPlan = ref<SubscriptionPlan | null>(null)
const selectedId = ref<string | null>(null)

const titles: Record<string, { title: string; description: string }> = {
  overview: { title: 'Plateforme', description: 'Entreprises clientes, abonnements et encaissements BravoStock.' },
  companies: { title: 'Entreprises', description: 'Comptes clients, statut et plan en cours.' },
  plans: { title: 'Plans', description: 'Offres, prix et modules inclus.' },
  subscriptions: { title: 'Abonnements', description: 'Périodes, sièges et impayés.' },
  billing: { title: 'Facturation', description: 'Factures d’abonnement BravoStock.' },
}

const header = computed(() => titles[tab.value] ?? titles.overview)

const companyStatusLabel: Record<CompanyStatus, string> = {
  active: 'Actif',
  trial: 'Essai',
  suspended: 'Suspendu',
  churned: 'Résilié',
}

const subscriptionLabel: Record<SubscriptionStatus, string> = {
  trialing: 'Essai',
  active: 'Actif',
  past_due: 'Impayé',
  canceled: 'Résilié',
  paused: 'En pause',
}

const invoiceLabel: Record<PlatformInvoiceStatus, string> = {
  draft: 'Brouillon',
  open: 'À payer',
  paid: 'Payée',
  overdue: 'En retard',
  void: 'Annulée',
}

function companyVariant(status: CompanyStatus) {
  if (status === 'active') return 'success' as const
  if (status === 'trial') return 'info' as const
  if (status === 'suspended') return 'warning' as const
  return 'outline' as const
}

function subscriptionVariant(status: SubscriptionStatus) {
  if (status === 'active') return 'success' as const
  if (status === 'trialing') return 'info' as const
  if (status === 'past_due') return 'critical' as const
  if (status === 'paused') return 'warning' as const
  return 'outline' as const
}

function invoiceVariant(status: PlatformInvoiceStatus) {
  if (status === 'paid') return 'success' as const
  if (status === 'overdue') return 'critical' as const
  if (status === 'open') return 'warning' as const
  return 'outline' as const
}

function cap(value: number) {
  return value === 0 ? 'Illimité' : String(value)
}

function moduleLabel(id: string) {
  return PLAN_MODULES.find((item) => item.id === id)?.label ?? id
}

const visibleRows = computed(() => {
  if (companyFilter.value === 'all') return rows.value
  return rows.value.filter((row) => row.company.status === companyFilter.value)
})

const companyCounts = computed(() => ({
  all: rows.value.length,
  active: rows.value.filter((row) => row.company.status === 'active').length,
  trial: rows.value.filter((row) => row.company.status === 'trial').length,
  suspended: rows.value.filter((row) => row.company.status === 'suspended').length,
  churned: rows.value.filter((row) => row.company.status === 'churned').length,
}))

const companyChips = computed(() => [
  { id: 'all' as const, label: 'Toutes', count: companyCounts.value.all },
  { id: 'active' as const, label: 'Actives', count: companyCounts.value.active },
  { id: 'trial' as const, label: 'Essai', count: companyCounts.value.trial },
  { id: 'suspended' as const, label: 'Suspendues', count: companyCounts.value.suspended },
])

const invoiceChips = [
  { id: 'all' as const, label: 'Toutes' },
  { id: 'open' as const, label: 'À payer' },
  { id: 'overdue' as const, label: 'En retard' },
  { id: 'paid' as const, label: 'Payées' },
]

const visibleInvoices = computed(() => {
  const list = [...invoices.value].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  if (invoiceFilter.value === 'all') return list
  return list.filter((item) => item.status === invoiceFilter.value)
})

const selectedRow = computed(() => rows.value.find((row) => row.company.id === selectedId.value) ?? null)

function companyName(id: string) {
  return rows.value.find((row) => row.company.id === id)?.company.name ?? id
}

function openNewCompany() {
  editingCompany.value = null
  companyOpen.value = true
}

function openEditCompany(company: Company) {
  editingCompany.value = company
  companyOpen.value = true
}

function openCompany(id: string) {
  selectedId.value = id
  detailOpen.value = true
}

function openNewPlan() {
  editingPlan.value = null
  planOpen.value = true
}

function openEditPlan(plan: SubscriptionPlan) {
  editingPlan.value = plan
  planOpen.value = true
}

async function saveCompany(input: CompanyInput) {
  await run(async () => {
    if (editingCompany.value) {
      await updateCompany(editingCompany.value.id, input)
    } else {
      await createCompany(input)
    }
    companyOpen.value = false
    editingCompany.value = null
  })
}

async function savePlan(input: PlanInput) {
  await run(async () => {
    if (editingPlan.value) await updatePlan(editingPlan.value.id, input)
    else await createPlan(input)
    planOpen.value = false
    editingPlan.value = null
  })
}

async function onChangePlan(input: { planId: string; interval: BillingInterval }) {
  if (!selectedId.value) return
  await run(async () => {
    await changeSubscription(selectedId.value!, input)
    detailOpen.value = false
    selectedId.value = null
  })
}

async function onStatus(status: CompanyStatus) {
  if (!selectedId.value) return
  await run(async () => {
    await setCompanyStatus(selectedId.value!, status)
    detailOpen.value = false
    selectedId.value = null
  })
}

async function onPay(id: string) {
  await run(async () => {
    await payInvoice(id)
    detailOpen.value = false
    selectedId.value = null
  }, id)
}
</script>

<template>
  <div class="page-wide">
    <PageHeader :title="header.title" :description="header.description">
      <template #actions>
        <Button v-if="tab === 'companies' || tab === 'overview'" size="sm" @click="openNewCompany">
          Nouvelle entreprise
        </Button>
        <Button v-else-if="tab === 'plans'" size="sm" @click="openNewPlan">Nouveau plan</Button>
      </template>
    </PageHeader>

    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />

    <div v-else-if="tab === 'overview'" class="space-y-5">
      <div class="metric-strip sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard label="Entreprises" :value="snapshot.companies" :icon="Building2" tone="info" />
        <SignalCard label="MRR" :value="formatMoney(snapshot.mrr)" :icon="Wallet" tone="success" />
        <SignalCard label="Essais" :value="snapshot.trial" :icon="CreditCard" />
        <SignalCard
          label="Impayés"
          :value="formatMoney(snapshot.overdueAmount)"
          :icon="TriangleAlert"
          :tone="snapshot.overdueCount ? 'critical' : 'success'"
          :trend="snapshot.overdueCount ? `${snapshot.overdueCount} facture(s)` : 'Rien en retard'"
        />
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-semibold">Comptes à suivre</h2>
        <article
          v-for="row in rows.filter((item) => item.company.status !== 'active' || item.unpaid > 0).slice(0, 6)"
          :key="row.company.id"
          class="surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
          @click="openCompany(row.company.id)"
        >
          <div>
            <p class="text-sm font-semibold">{{ row.company.name }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ row.company.city }} · {{ row.plan?.name ?? 'Sans plan' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Badge :variant="companyVariant(row.company.status)">{{ companyStatusLabel[row.company.status] }}</Badge>
            <span v-if="row.unpaid" class="text-sm font-semibold text-red-700">{{ formatMoney(row.unpaid) }}</span>
          </div>
        </article>
      </div>
    </div>

    <div v-else-if="tab === 'companies'" class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in companyChips"
          :key="chip.id"
          class="chip"
          :class="companyFilter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="companyFilter = chip.id"
        >
          {{ chip.label }} · {{ chip.count }}
        </button>
      </div>
      <EmptyState v-if="!visibleRows.length" title="Aucune entreprise" />
      <article
        v-for="row in visibleRows"
        :key="row.company.id"
        class="surface flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
        @click="openCompany(row.company.id)"
      >
        <div>
          <p class="text-sm font-semibold">{{ row.company.name }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ row.company.city }} · {{ row.company.usersCount }} utilisateurs · {{ row.company.warehousesCount }} sites
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Badge v-if="row.plan" variant="outline">{{ row.plan.name }}</Badge>
          <Badge :variant="companyVariant(row.company.status)">{{ companyStatusLabel[row.company.status] }}</Badge>
          <span class="text-sm font-semibold">{{ formatMoney(row.mrr) }}/mois</span>
        </div>
      </article>
    </div>

    <div v-else-if="tab === 'plans'" class="grid gap-3 md:grid-cols-3">
      <article v-for="plan in plans" :key="plan.id" class="surface flex flex-col p-5">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold">{{ plan.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ plan.description }}</p>
          </div>
          <Badge :variant="plan.active ? 'success' : 'outline'">{{ plan.active ? 'Actif' : 'Masqué' }}</Badge>
        </div>
        <p class="mt-4 text-2xl font-semibold">{{ formatMoney(plan.monthlyPrice) }}</p>
        <p class="text-xs text-muted-foreground">par mois · {{ formatMoney(plan.yearlyPrice) }} / an</p>
        <p class="mt-3 text-xs text-muted-foreground">
          {{ cap(plan.maxUsers) }} utilisateurs · {{ cap(plan.maxWarehouses) }} entrepôts
        </p>
        <p class="mt-2 text-xs text-muted-foreground">{{ plan.modules.map(moduleLabel).join(' · ') }}</p>
        <Button class="mt-4" size="sm" variant="outline" @click="openEditPlan(plan)">Modifier</Button>
      </article>
    </div>

    <div v-else-if="tab === 'subscriptions'" class="space-y-2">
      <article
        v-for="row in rows"
        :key="row.company.id"
        class="surface flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
        @click="openCompany(row.company.id)"
      >
        <div>
          <p class="text-sm font-semibold">{{ row.company.name }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ row.plan?.name ?? '—' }} ·
            {{ row.subscription?.interval === 'yearly' ? 'Annuel' : 'Mensuel' }}
            <span v-if="row.subscription"> · jusqu’au {{ formatDate(row.subscription.currentPeriodEnd) }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Badge v-if="row.subscription" :variant="subscriptionVariant(row.subscription.status)">
            {{ subscriptionLabel[row.subscription.status] }}
          </Badge>
          <span class="text-sm font-semibold">{{ formatMoney(row.mrr) }}/mois</span>
        </div>
      </article>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in invoiceChips"
          :key="chip.id"
          class="chip"
          :class="invoiceFilter === chip.id ? 'chip-active' : 'bg-card text-muted-foreground'"
          @click="invoiceFilter = chip.id"
        >
          {{ chip.label }}
        </button>
      </div>
      <EmptyState v-if="!visibleInvoices.length" title="Aucune facture" />
      <article
        v-for="invoice in visibleInvoices"
        :key="invoice.id"
        class="surface flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <div>
          <p class="text-sm font-semibold">{{ invoice.number }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ companyName(invoice.companyId) }} · éch. {{ formatDate(invoice.dueDate) }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">{{ formatMoney(invoice.amount) }}</span>
          <Badge :variant="invoiceVariant(invoice.status)">{{ invoiceLabel[invoice.status] }}</Badge>
          <Button
            v-if="invoice.status === 'open' || invoice.status === 'overdue'"
            size="sm"
            :loading="isBusy(invoice.id)"
            @click="onPay(invoice.id)"
          >
            Encaisser
          </Button>
        </div>
      </article>
    </div>

    <CompanyFormSheet
      :open="companyOpen"
      :company="editingCompany"
      :plans="plans"
      @close="companyOpen = false"
      @submit="saveCompany"
    />
    <PlanFormSheet :open="planOpen" :plan="editingPlan" @close="planOpen = false" @submit="savePlan" />
    <CompanyDetailSheet
      :open="detailOpen"
      :company="selectedRow?.company ?? null"
      :plan="selectedRow?.plan"
      :subscription="selectedRow?.subscription"
      :plans="plans"
      :invoices="invoices"
      :users="users"
      @close="detailOpen = false"
      @edit="selectedRow && openEditCompany(selectedRow.company)"
      @status="onStatus"
      @change-plan="onChangePlan"
      @pay="onPay"
    />
  </div>
</template>
