<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Label from '@/components/ui/Label.vue'
import Avatar from '@/components/ui/Avatar.vue'
import { formatDate, formatMoney } from '@/lib/utils'
import type {
  BillingInterval,
  Company,
  CompanyStatus,
  PlatformInvoice,
  PlatformInvoiceStatus,
  RoleKey,
  Subscription,
  SubscriptionPlan,
  User,
} from '@/types'

const props = defineProps<{
  open: boolean
  company: Company | null
  plan?: SubscriptionPlan
  subscription?: Subscription
  plans: SubscriptionPlan[]
  invoices: PlatformInvoice[]
  users?: User[]
}>()

const emit = defineEmits<{
  close: []
  edit: []
  status: [status: CompanyStatus]
  changePlan: [input: { planId: string; interval: BillingInterval }]
  pay: [id: string]
}>()

const planId = ref('')
const interval = ref<BillingInterval>('monthly')

watch(
  () => [props.open, props.subscription?.planId, props.subscription?.interval],
  () => {
    planId.value = props.subscription?.planId ?? ''
    interval.value = props.subscription?.interval ?? 'monthly'
  },
)

const relatedInvoices = computed(() =>
  props.invoices.filter((item) => item.companyId === props.company?.id).slice(0, 8),
)

const companyUsers = computed(() =>
  (props.users ?? []).filter((user) => user.companyId === props.company?.id),
)

const unnamedSeats = computed(() =>
  Math.max(0, (props.company?.usersCount ?? 0) - companyUsers.value.length),
)

const roleLabel: Partial<Record<RoleKey, string>> = {
  SUPER_ADMIN: 'Super admin',
  TENANT_OWNER: 'Propriétaire',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  WAREHOUSE_MANAGER: 'Magasin',
  PROCUREMENT: 'Achats',
  FINANCE: 'Finance',
  DISPATCHER: 'Dispatch',
  DRIVER: 'Chauffeur',
  AUDITOR: 'Auditeur',
}

const dirty = computed(
  () => planId.value !== props.subscription?.planId || interval.value !== props.subscription?.interval,
)

function invoiceVariant(status: PlatformInvoiceStatus) {
  if (status === 'paid') return 'success' as const
  if (status === 'overdue') return 'critical' as const
  if (status === 'open') return 'warning' as const
  return 'outline' as const
}

const invoiceLabel: Record<PlatformInvoiceStatus, string> = {
  draft: 'Brouillon',
  open: 'À payer',
  paid: 'Payée',
  overdue: 'En retard',
  void: 'Annulée',
}
</script>

<template>
  <Sheet :open="open" :title="company?.name ?? 'Entreprise'" wide @close="emit('close')">
    <div v-if="company" class="space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm text-muted-foreground">{{ company.legalName }}</p>
          <p class="mt-1 text-sm">{{ company.city }} · {{ company.email }}</p>
          <p v-if="company.phone" class="mt-1 text-sm text-muted-foreground">{{ company.phone }}</p>
          <p v-if="company.ice" class="mt-1 text-xs text-muted-foreground">ICE {{ company.ice }}</p>
        </div>
        <Button size="sm" variant="outline" @click="emit('edit')">Modifier</Button>
      </div>

      <div class="grid gap-2 sm:grid-cols-3">
        <article class="rounded-md border px-3 py-2">
          <p class="text-[11px] text-muted-foreground">Utilisateurs</p>
          <p class="mt-1 text-sm font-semibold">{{ company.usersCount }}</p>
        </article>
        <article class="rounded-md border px-3 py-2">
          <p class="text-[11px] text-muted-foreground">Entrepôts</p>
          <p class="mt-1 text-sm font-semibold">{{ company.warehousesCount }}</p>
        </article>
        <article class="rounded-md border px-3 py-2">
          <p class="text-[11px] text-muted-foreground">Depuis</p>
          <p class="mt-1 text-sm font-semibold">{{ formatDate(company.createdAt) }}</p>
        </article>
      </div>

      <div>
        <p class="text-sm font-semibold">Utilisateurs</p>
        <ul v-if="companyUsers.length" class="mt-2 divide-y">
          <li v-for="user in companyUsers" :key="user.id" class="flex items-center gap-3 py-2.5">
            <Avatar :first-name="user.firstName" :last-name="user.lastName" :hue="user.avatarHue" class="size-8 text-[10px]" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{{ user.firstName }} {{ user.lastName }}</p>
              <p class="text-xs text-muted-foreground">{{ user.email }}</p>
            </div>
            <Badge variant="info">{{ roleLabel[user.role] ?? user.role }}</Badge>
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-muted-foreground">Aucun compte rattaché pour l’instant.</p>
        <p v-if="unnamedSeats" class="mt-2 text-xs text-muted-foreground">
          {{ unnamedSeats }} autre{{ unnamedSeats > 1 ? 's' : '' }} siège{{ unnamedSeats > 1 ? 's' : '' }} sur l’abonnement.
        </p>
      </div>

      <div>
        <p class="text-sm font-semibold">Abonnement</p>
        <div class="mt-2 space-y-3">
          <div>
            <Label>Plan</Label>
            <select v-model="planId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
              <option v-for="item in plans" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </div>
          <div>
            <Label>Facturation</Label>
            <select v-model="interval" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
              <option value="monthly">Mensuelle</option>
              <option value="yearly">Annuelle</option>
            </select>
          </div>
          <p v-if="subscription" class="text-xs text-muted-foreground">
            Période jusqu’au {{ formatDate(subscription.currentPeriodEnd) }}
            <span v-if="subscription.trialEndsAt"> · essai jusqu’au {{ formatDate(subscription.trialEndsAt) }}</span>
          </p>
          <Button size="sm" :disabled="!dirty" @click="emit('changePlan', { planId, interval })">
            Appliquer le plan
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button
          v-if="company.status !== 'suspended'"
          size="sm"
          variant="outline"
          @click="emit('status', 'suspended')"
        >
          Suspendre
        </Button>
        <Button
          v-if="company.status === 'suspended' || company.status === 'churned'"
          size="sm"
          @click="emit('status', 'active')"
        >
          Réactiver
        </Button>
        <Button
          v-if="company.status !== 'churned'"
          size="sm"
          variant="destructive"
          @click="emit('status', 'churned')"
        >
          Résilier
        </Button>
      </div>

      <div>
        <p class="text-sm font-semibold">Factures</p>
        <ul v-if="relatedInvoices.length" class="mt-2 divide-y">
          <li v-for="invoice in relatedInvoices" :key="invoice.id" class="flex items-center justify-between gap-3 py-2.5">
            <div>
              <p class="text-sm font-medium">{{ invoice.number }}</p>
              <p class="text-xs text-muted-foreground">Éch. {{ formatDate(invoice.dueDate) }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">{{ formatMoney(invoice.amount) }}</span>
              <Badge :variant="invoiceVariant(invoice.status)">{{ invoiceLabel[invoice.status] }}</Badge>
              <Button
                v-if="invoice.status === 'open' || invoice.status === 'overdue'"
                size="sm"
                @click="emit('pay', invoice.id)"
              >
                Encaisser
              </Button>
            </div>
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-muted-foreground">Aucune facture.</p>
      </div>
    </div>
  </Sheet>
</template>
