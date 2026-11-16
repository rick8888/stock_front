<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { BILLING_COUNTRIES, billingCountry, DEFAULT_BILLING_COUNTRY, type BillingCountry } from '@/config/billingCountries'
import { companyCountry, planPrice } from '@/services/platform.pricing'
import { formatMoney } from '@/lib/utils'
import type { BillingInterval, Company, SubscriptionPlan } from '@/types'
import type { CompanyInput } from '@/repositories/interfaces'

const props = withDefaults(
  defineProps<{
    open: boolean
    company?: Company | null
    plans: SubscriptionPlan[]
    /** Le pays fixe la grille tarifaire : seul BravoStock peut le changer. */
    countryEditable?: boolean
  }>(),
  { company: null, countryEditable: true },
)

const emit = defineEmits<{
  close: []
  submit: [input: CompanyInput]
}>()

const name = ref('')
const legalName = ref('')
const ice = ref('')
const city = ref('')
const email = ref('')
const phone = ref('')
const country = ref<BillingCountry>(DEFAULT_BILLING_COUNTRY)
const planId = ref('')
const interval = ref<BillingInterval>('monthly')

const editing = computed(() => Boolean(props.company))
// Seuls les plans actifs ayant un tarif dans le pays choisi sont proposés.
const offerPlans = computed(() =>
  props.plans.filter((plan) => plan.active && planPrice(plan, country.value) !== null),
)

function planLabel(plan: SubscriptionPlan) {
  const price = planPrice(plan, country.value)
  return price ? `${plan.name} · ${formatMoney(price.monthly, price.currency)} / mois` : plan.name
}

watch(country, () => {
  if (!offerPlans.value.some((plan) => plan.id === planId.value)) planId.value = offerPlans.value[0]?.id ?? ''
})

const canSubmit = computed(
  () =>
    name.value.trim().length > 1 &&
    city.value.trim().length > 1 &&
    email.value.includes('@') &&
    (editing.value || Boolean(planId.value)),
)

function reset() {
  name.value = props.company?.name ?? ''
  legalName.value = props.company?.legalName ?? ''
  ice.value = props.company?.ice ?? ''
  city.value = props.company?.city ?? ''
  email.value = props.company?.email ?? ''
  phone.value = props.company?.phone ?? ''
  country.value = companyCountry(props.company)
  planId.value = offerPlans.value[0]?.id ?? ''
  interval.value = 'monthly'
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    name: name.value.trim(),
    legalName: legalName.value.trim() || name.value.trim(),
    ice: ice.value.trim(),
    city: city.value.trim(),
    email: email.value.trim(),
    phone: phone.value.trim(),
    country: country.value,
    planId: planId.value,
    interval: interval.value,
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier l’entreprise' : 'Nouvelle entreprise'" @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Nom commercial</Label>
        <Input v-model="name" class="mt-1.5" placeholder="Atlas Distribution" />
      </div>
      <div>
        <Label>Raison sociale</Label>
        <Input v-model="legalName" class="mt-1.5" placeholder="Atlas Distribution SARL" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{{ billingCountry(country).taxIdLabel }}</Label>
          <Input v-model="ice" class="mt-1.5" :placeholder="country === 'MA' ? '001845632000089' : ''" />
        </div>
        <div>
          <Label>Ville</Label>
          <Input v-model="city" class="mt-1.5" placeholder="Casablanca" />
        </div>
      </div>
      <div>
        <Label>Pays de facturation</Label>
        <select
          v-model="country"
          class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm disabled:opacity-60"
          :disabled="!countryEditable"
        >
          <option v-for="item in BILLING_COUNTRIES" :key="item.code" :value="item.code">
            {{ item.flag }} {{ item.name }} · {{ item.currency }}
          </option>
        </select>
        <p v-if="editing && countryEditable" class="mt-1 text-[11px] text-muted-foreground">
          Les prochaines factures seront émises au tarif et dans la devise de ce pays.
        </p>
        <p v-else-if="!countryEditable" class="mt-1 text-[11px] text-muted-foreground">
          Pour changer de pays de facturation, contactez BravoStock.
        </p>
      </div>
      <div>
        <Label>Email</Label>
        <Input v-model="email" class="mt-1.5" type="email" placeholder="direction@entreprise.ma" />
      </div>
      <div>
        <Label>Téléphone</Label>
        <Input v-model="phone" class="mt-1.5" placeholder="0522 40 12 80" />
      </div>
      <template v-if="!editing">
        <div>
          <Label>Plan</Label>
          <select v-model="planId" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
            <option v-for="plan in offerPlans" :key="plan.id" :value="plan.id">
              {{ planLabel(plan) }}
            </option>
          </select>
          <p v-if="!offerPlans.length" class="mt-1 text-[11px] text-red-700">
            Aucun plan actif n’a de tarif pour ce pays. Ajoutez-en un dans Plans.
          </p>
        </div>
        <div>
          <Label>Facturation</Label>
          <select v-model="interval" class="mt-1.5 h-10 w-full rounded-md border bg-card px-3 text-sm">
            <option value="monthly">Mensuelle</option>
            <option value="yearly">Annuelle</option>
          </select>
        </div>
        <p class="text-xs text-muted-foreground">L’entreprise démarre en essai de 14 jours.</p>
      </template>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer' }}
      </Button>
    </template>
  </Sheet>
</template>
