<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Building2, Package, ShoppingCart, TriangleAlert, Truck, Users, Wallet } from 'lucide-vue-next'
import { useAccount } from '@/composables/useAccount'
import { usePermissions } from '@/composables/usePermissions'
import { useActionBusy } from '@/composables/useActionBusy'
import { PLAN_MODULES } from '@/mocks/platform'
import PageHeader from '@/components/common/PageHeader.vue'
import SignalCard from '@/components/common/SignalCard.vue'
import PageSkeleton from '@/components/feedback/PageSkeleton.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Avatar from '@/components/ui/Avatar.vue'
import CompanyFormSheet from '@/components/platform/CompanyFormSheet.vue'
import TenantAdminSheet from '@/components/account/TenantAdminSheet.vue'
import { formatDate, formatMoney } from '@/lib/utils'
import type { BillingInterval, PlatformInvoiceStatus, SubscriptionStatus, User } from '@/types'
import type { CompanyInput, UserInput } from '@/repositories/interfaces'

const route = useRoute()
const { can } = usePermissions()
const { busy, run, isBusy } = useActionBusy()
const {
  company,
  plan,
  plans,
  subscription,
  invoices,
  admins,
  mrr,
  unpaid,
  loading,
  error,
  ops,
  opsDetail,
  updateCompany,
  changeSubscription,
  payInvoice,
  startCheckout,
  openPortal,
  createAdmin,
  updateAdmin,
} = useAccount()

const tab = computed(() => (typeof route.query.tab === 'string' ? route.query.tab : 'overview'))
const companyOpen = ref(false)
const adminOpen = ref(false)
const editingAdmin = ref<User | null>(null)
const adminError = ref('')
const actionError = ref('')
const invoiceFilter = ref<'all' | PlatformInvoiceStatus>('all')
const draftPlanId = ref('')
const draftInterval = ref<BillingInterval>('monthly')
const opsFocus = ref<'risks' | 'delayed' | 'deliveries' | null>(null)

const titles: Record<string, { title: string; description: string }> = {
  overview: { title: 'Compte', description: 'Votre entreprise, votre abonnement et vos factures Bravo.Stock.' },
  company: { title: 'Entreprise', description: 'Fiche légale et coordonnées visibles par Bravo.Stock.' },
  admins: { title: 'Administrateurs', description: 'Les comptes qui gèrent le quotidien opérationnel.' },
  subscription: { title: 'Abonnement', description: 'Plan, facturation et sièges de votre entreprise.' },
  billing: { title: 'Factures', description: 'Les factures Bravo.Stock de votre compte.' },
}

const header = computed(() => titles[tab.value] ?? titles.overview)
const locked = computed(() => company.value?.status === 'suspended')

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

watch(
  () => [subscription.value?.planId, subscription.value?.interval] as const,
  ([planId, interval]) => {
    if (planId) draftPlanId.value = planId
    if (interval) draftInterval.value = interval
  },
  { immediate: true },
)

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

const dirtySubscription = computed(
  () =>
    draftPlanId.value !== (subscription.value?.planId ?? '') ||
    draftInterval.value !== (subscription.value?.interval ?? 'monthly'),
)

async function saveCompany(input: CompanyInput) {
  await run(async () => {
    actionError.value = ''
    try {
      await updateCompany({
        name: input.name,
        legalName: input.legalName,
        ice: input.ice,
        city: input.city,
        email: input.email,
        phone: input.phone,
      })
      companyOpen.value = false
    } catch (err) {
      actionError.value = err instanceof Error ? err.message : 'Enregistrement impossible'
    }
  })
}

async function saveSubscription() {
  if (locked.value || !dirtySubscription.value) return
  await run(async () => {
    actionError.value = ''
    try {
      await changeSubscription({ planId: draftPlanId.value, interval: draftInterval.value })
    } catch (err) {
      actionError.value = err instanceof Error ? err.message : 'Changement impossible'
    }
  })
}

async function onPay(id: string) {
  await run(async () => {
    actionError.value = ''
    try {
      await payInvoice(id)
    } catch (err) {
      actionError.value = err instanceof Error ? err.message : 'Paiement impossible'
    }
  }, id)
}

async function onCheckout() {
  await run(async () => {
    actionError.value = ''
    try {
      await startCheckout({ planId: draftPlanId.value, interval: draftInterval.value })
    } catch (err) {
      actionError.value = err instanceof Error ? err.message : 'Checkout impossible'
    }
  })
}

async function onPortal() {
  await run(async () => {
    actionError.value = ''
    try {
      await openPortal()
    } catch (err) {
      actionError.value = err instanceof Error ? err.message : 'Portail impossible'
    }
  })
}

function openNewAdmin() {
  editingAdmin.value = null
  adminError.value = ''
  adminOpen.value = true
}

function openEditAdmin(user: User) {
  editingAdmin.value = user
  adminError.value = ''
  adminOpen.value = true
}

async function saveAdmin(payload: { id?: string; input: UserInput }) {
  await run(async () => {
    adminError.value = ''
    try {
      if (payload.id) await updateAdmin(payload.id, payload.input)
      else await createAdmin(payload.input)
      adminOpen.value = false
      editingAdmin.value = null
    } catch (err) {
      adminError.value = err instanceof Error ? err.message : 'Enregistrement impossible'
    }
  })
}
</script>

<template>
  <div class="page-wide">
    <PageHeader :title="header.title" :description="header.description">
      <template #actions>
        <Button v-if="tab === 'company' && can('account.company') && !locked" size="sm" @click="companyOpen = true">
          Modifier la fiche
        </Button>
        <Button v-else-if="tab === 'admins' && can('account.admins') && !locked" size="sm" @click="openNewAdmin">
          Nouvel administrateur
        </Button>
      </template>
    </PageHeader>

    <PageSkeleton v-if="loading" />
    <ErrorState v-else-if="error" :message="error" />

    <div v-else class="space-y-5">
      <div v-if="locked" class="surface border border-amber-200 bg-amber-50 px-4 py-3">
        <p class="text-sm font-semibold text-amber-950">Compte suspendu</p>
        <p class="mt-1 text-sm text-amber-900">
          Bravo.Stock a suspendu cette entreprise. Contactez le support pour rétablir l’accès opérationnel.
        </p>
      </div>
      <div v-else-if="company?.status === 'churned'" class="surface border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p class="text-sm font-semibold">Abonnement résilié</p>
        <p class="mt-1 text-sm text-muted-foreground">Ce compte n’est plus facturé. Contactez Bravo.Stock pour le réactiver.</p>
      </div>
      <p v-if="actionError" class="text-sm text-destructive">{{ actionError }}</p>

      <div v-if="tab === 'overview'" class="space-y-5">
        <div class="metric-strip sm:grid-cols-2 xl:grid-cols-4">
          <SignalCard label="Plan" :value="plan?.name ?? '—'" :icon="Building2" tone="info" />
          <SignalCard label="Abonnement" :value="formatMoney(mrr)" :icon="Wallet" :tone="unpaid ? 'warning' : 'success'" />
          <SignalCard
            label="Administrateurs"
            :value="admins.length"
            :icon="Users"
          />
          <SignalCard
            label="À régler"
            :value="formatMoney(unpaid)"
            :icon="TriangleAlert"
            :tone="unpaid ? 'critical' : 'success'"
            :trend="unpaid ? 'Facture(s) ouverte(s)' : 'Rien en attente'"
          />
        </div>
        <div v-if="ops" class="metric-strip sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" class="text-left" @click="opsFocus = opsFocus === 'risks' ? null : 'risks'">
            <SignalCard label="Ruptures" :value="ops.stockRisks" :icon="Package" :tone="ops.stockRisks ? 'warning' : 'success'" :class="opsFocus === 'risks' ? 'ring-1 ring-primary/30' : ''" />
          </button>
          <button type="button" class="text-left" @click="opsFocus = opsFocus === 'delayed' ? null : 'delayed'">
            <SignalCard label="Commandes en retard" :value="ops.delayedOrders" :icon="ShoppingCart" :tone="ops.delayedOrders ? 'critical' : 'success'" :class="opsFocus === 'delayed' ? 'ring-1 ring-primary/30' : ''" />
          </button>
          <button type="button" class="text-left" @click="opsFocus = opsFocus === 'deliveries' ? null : 'deliveries'">
            <SignalCard label="Livraisons à risque" :value="ops.deliveryRisks" :icon="Truck" :tone="ops.deliveryRisks ? 'warning' : 'success'" :class="opsFocus === 'deliveries' ? 'ring-1 ring-primary/30' : ''" />
          </button>
          <SignalCard label="Flux net" :value="ops.netFlow" :icon="Wallet" tone="info" />
        </div>
        <div v-if="opsFocus === 'risks'" class="space-y-2">
          <p class="text-sm font-semibold">Articles sous seuil</p>
          <p v-if="!opsDetail?.risks.length" class="text-sm text-muted-foreground">Aucune rupture.</p>
          <article v-for="row in opsDetail?.risks ?? []" :key="row.product.id + (row.warehouse?.id ?? '')" class="surface px-4 py-3">
            <p class="text-sm font-medium">{{ row.product.name }}</p>
            <p class="text-xs text-muted-foreground">{{ row.warehouse?.name }} · {{ Math.max(1, Math.round(row.days)) }} j</p>
          </article>
        </div>
        <div v-else-if="opsFocus === 'delayed'" class="space-y-2">
          <p class="text-sm font-semibold">Commandes en retard</p>
          <p v-if="!opsDetail?.delayed.length" class="text-sm text-muted-foreground">Aucun retard.</p>
          <article v-for="order in opsDetail?.delayed ?? []" :key="order.id" class="surface px-4 py-3">
            <p class="text-sm font-medium">{{ (order.code ?? order.id).toUpperCase() }}</p>
            <p class="text-xs text-muted-foreground">
              {{ opsDetail?.suppliers.find((item) => item.id === order.supplierId)?.name }} · prévue {{ formatDate(order.expectedDate) }}
            </p>
          </article>
        </div>
        <div v-else-if="opsFocus === 'deliveries'" class="space-y-2">
          <p class="text-sm font-semibold">Livraisons à risque</p>
          <p v-if="!opsDetail?.atRisk.length" class="text-sm text-muted-foreground">Rien à signaler.</p>
          <article v-for="item in opsDetail?.atRisk ?? []" :key="item.id" class="surface px-4 py-3">
            <p class="text-sm font-medium">{{ item.client }}</p>
            <p class="text-xs text-muted-foreground">{{ item.city }} · {{ formatDate(item.scheduledAt) }}</p>
          </article>
        </div>
        <article class="surface px-4 py-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{{ company?.name }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ company?.city }} · {{ company?.usersCount }} utilisateurs · {{ company?.warehousesCount }} sites
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Badge v-if="plan" variant="outline">{{ plan.name }}</Badge>
              <Badge v-if="subscription" :variant="subscriptionVariant(subscription.status)">
                {{ subscriptionLabel[subscription.status] }}
              </Badge>
            </div>
          </div>
          <p v-if="subscription" class="mt-3 text-xs text-muted-foreground">
            {{ subscription.interval === 'yearly' ? 'Facturation annuelle' : 'Facturation mensuelle' }}
            · jusqu’au {{ formatDate(subscription.currentPeriodEnd) }}
            · {{ company?.usersCount ?? 0 }} / {{ subscription.seats }} sièges
          </p>
        </article>
      </div>

      <div v-else-if="tab === 'company'" class="space-y-3">
        <article class="surface space-y-3 px-4 py-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <p class="text-[11px] font-medium text-muted-foreground">Nom commercial</p>
              <p class="mt-0.5 text-sm font-semibold">{{ company?.name }}</p>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted-foreground">Raison sociale</p>
              <p class="mt-0.5 text-sm">{{ company?.legalName }}</p>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted-foreground">ICE</p>
              <p class="mt-0.5 text-sm">{{ company?.ice || '—' }}</p>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted-foreground">Ville</p>
              <p class="mt-0.5 text-sm">{{ company?.city }}</p>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted-foreground">Email</p>
              <p class="mt-0.5 text-sm">{{ company?.email }}</p>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted-foreground">Téléphone</p>
              <p class="mt-0.5 text-sm">{{ company?.phone || '—' }}</p>
            </div>
          </div>
        </article>
      </div>

      <div v-else-if="tab === 'admins'" class="space-y-2">
        <EmptyState v-if="!admins.length" title="Aucun administrateur" description="Créez le premier compte qui gérera les opérations." />
        <article
          v-for="user in admins"
          :key="user.id"
          class="surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
          @click="!locked && can('account.admins') && openEditAdmin(user)"
        >
          <div class="flex min-w-0 items-center gap-3">
            <Avatar :first-name="user.firstName" :last-name="user.lastName" :hue="user.avatarHue" />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold">{{ user.firstName }} {{ user.lastName }}</p>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ user.title }} · {{ user.email }}</p>
            </div>
          </div>
          <Badge variant="info">Admin</Badge>
        </article>
      </div>

      <div v-else-if="tab === 'subscription'" class="space-y-4">
        <article class="surface px-4 py-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold">{{ plan?.name ?? 'Sans plan' }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ formatMoney(mrr) }} / mois
                <span v-if="subscription"> · jusqu’au {{ formatDate(subscription.currentPeriodEnd) }}</span>
              </p>
            </div>
            <Badge v-if="subscription" :variant="subscriptionVariant(subscription.status)">
              {{ subscriptionLabel[subscription.status] }}
            </Badge>
          </div>
          <p v-if="plan" class="mt-3 text-xs text-muted-foreground">
            {{ plan.modules.map(moduleLabel).join(' · ') }}
          </p>
          <div v-if="plan" class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl border px-3 py-2.5">
              <p class="text-[11px] text-muted-foreground">Utilisateurs</p>
              <p class="mt-1 text-lg font-semibold tabular-nums">
                {{ company?.usersCount ?? 0 }}
                <span class="text-sm font-normal text-muted-foreground">/ {{ cap(plan.maxUsers) }}</span>
              </p>
            </div>
            <div class="rounded-xl border px-3 py-2.5">
              <p class="text-[11px] text-muted-foreground">Entrepôts</p>
              <p class="mt-1 text-lg font-semibold tabular-nums">
                {{ company?.warehousesCount ?? 0 }}
                <span class="text-sm font-normal text-muted-foreground">/ {{ cap(plan.maxWarehouses) }}</span>
              </p>
            </div>
          </div>
        </article>

        <div v-if="can('account.billing')" class="surface space-y-4 px-4 py-4">
          <p class="text-sm font-semibold">Changer d’offre</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="text-sm">
              <span class="mb-1.5 block text-[11px] font-medium text-muted-foreground">Plan</span>
              <select v-model="draftPlanId" class="h-10 w-full rounded-md border bg-card px-3 text-sm" :disabled="locked">
                <option v-for="item in plans" :key="item.id" :value="item.id">
                  {{ item.name }} · {{ formatMoney(item.monthlyPrice) }}/mois
                </option>
              </select>
            </label>
            <label class="text-sm">
              <span class="mb-1.5 block text-[11px] font-medium text-muted-foreground">Facturation</span>
              <select v-model="draftInterval" class="h-10 w-full rounded-md border bg-card px-3 text-sm" :disabled="locked">
                <option value="monthly">Mensuelle</option>
                <option value="yearly">Annuelle</option>
              </select>
            </label>
          </div>
          <p class="text-xs text-muted-foreground">Un changement de plan ou d’intervalle génère une nouvelle facture. Avec Stripe, utilisez Checkout ou le portail.</p>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" :loading="busy" :disabled="locked || !dirtySubscription" @click="saveSubscription">Enregistrer</Button>
            <Button size="sm" variant="outline" :loading="busy" :disabled="locked" @click="onCheckout">S’abonner (Stripe)</Button>
            <Button size="sm" variant="outline" :loading="busy" :disabled="locked" @click="onPortal">Gérer la facturation</Button>
          </div>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="chip in invoiceChips"
            :key="chip.id"
            class="chip"
            :class="invoiceFilter === chip.id ? 'bg-zinc-950 text-white' : 'bg-card text-muted-foreground'"
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
            <p class="mt-0.5 text-xs text-muted-foreground">échéance {{ formatDate(invoice.dueDate) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">{{ formatMoney(invoice.amount) }}</span>
            <Badge :variant="invoiceVariant(invoice.status)">{{ invoiceLabel[invoice.status] }}</Badge>
            <p v-if="invoice.status === 'paid' && invoice.paymentRef" class="text-[11px] text-muted-foreground">
              {{ invoice.paymentProvider ?? 'stub' }} · {{ invoice.paymentRef }}
            </p>
            <Button
              v-if="can('account.billing') && (invoice.status === 'open' || invoice.status === 'overdue')"
              size="sm"
              :disabled="locked"
              :loading="isBusy(invoice.id)"
              @click="onPay(invoice.id)"
            >
              Payer
            </Button>
          </div>
        </article>
      </div>
    </div>

    <CompanyFormSheet
      :open="companyOpen"
      :company="company"
      :plans="plans"
      @close="companyOpen = false"
      @submit="saveCompany"
    />
    <TenantAdminSheet
      :open="adminOpen"
      :user="editingAdmin"
      :error="adminError"
      @close="adminOpen = false"
      @submit="saveAdmin"
    />
  </div>
</template>
