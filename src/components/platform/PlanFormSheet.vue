<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Switch from '@/components/ui/Switch.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import { PLAN_MODULES } from '@/mocks/platform'
import { BILLING_COUNTRIES, type BillingCountry } from '@/config/billingCountries'
import { planPrice } from '@/services/platform.pricing'
import type { PlanModule, PlanPrices, SubscriptionPlan } from '@/types'
import type { PlanInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  plan?: SubscriptionPlan | null
}>()

const emit = defineEmits<{
  close: []
  submit: [input: PlanInput]
}>()

const name = ref('')
const code = ref('')
const description = ref('')
// Saisie texte par pays : mensuel vide = plan non proposé dans ce pays.
type PriceDraft = { monthly: string; yearly: string; stripePriceMonthly?: string; stripePriceYearly?: string }
const prices = ref<Record<BillingCountry, PriceDraft>>(emptyPrices())
const maxUsers = ref('25')
const maxWarehouses = ref('5')
const modules = ref<PlanModule[]>(['stock', 'procurement'])
const active = ref(true)

const editing = computed(() => Boolean(props.plan))
const offeredCount = computed(
  () => BILLING_COUNTRIES.filter((country) => prices.value[country.code].monthly.trim() !== '').length,
)
const canSubmit = computed(() => name.value.trim().length > 1 && offeredCount.value > 0)

function emptyPrices(): Record<BillingCountry, PriceDraft> {
  return Object.fromEntries(BILLING_COUNTRIES.map((country) => [country.code, { monthly: '', yearly: '' }])) as Record<
    BillingCountry,
    PriceDraft
  >
}

function pricesFromPlan(plan?: SubscriptionPlan | null) {
  const drafts = emptyPrices()
  if (!plan) {
    drafts.MA = { monthly: '2490', yearly: '24900' }
    return drafts
  }
  for (const country of BILLING_COUNTRIES) {
    const price = planPrice(plan, country.code)
    if (!price) continue
    const stored = plan.prices?.[country.code]
    drafts[country.code] = {
      monthly: String(price.monthly),
      yearly: String(price.yearly),
      stripePriceMonthly: stored?.stripePriceMonthly,
      stripePriceYearly: stored?.stripePriceYearly,
    }
  }
  return drafts
}

function pricesInput(): PlanPrices {
  const out: PlanPrices = {}
  for (const country of BILLING_COUNTRIES) {
    const draft = prices.value[country.code]
    if (draft.monthly.trim() === '') continue
    const monthly = Math.max(0, Math.round(Number(draft.monthly)))
    const yearly = draft.yearly.trim() === '' ? monthly * 10 : Math.max(0, Math.round(Number(draft.yearly)))
    out[country.code] = {
      monthly,
      yearly,
      ...(draft.stripePriceMonthly ? { stripePriceMonthly: draft.stripePriceMonthly } : {}),
      ...(draft.stripePriceYearly ? { stripePriceYearly: draft.stripePriceYearly } : {}),
    }
  }
  return out
}

function setModule(id: PlanModule, on: boolean) {
  if (on && !modules.value.includes(id)) modules.value = [...modules.value, id]
  else if (!on) modules.value = modules.value.filter((item) => item !== id)
}

function reset() {
  name.value = props.plan?.name ?? ''
  code.value = props.plan?.code ?? ''
  description.value = props.plan?.description ?? ''
  prices.value = pricesFromPlan(props.plan)
  maxUsers.value = String(props.plan?.maxUsers ?? 25)
  maxWarehouses.value = String(props.plan?.maxWarehouses ?? 5)
  modules.value = props.plan ? [...props.plan.modules] : ['stock', 'procurement']
  active.value = props.plan?.active ?? true
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
    code: code.value.trim() || name.value.trim(),
    description: description.value.trim(),
    prices: pricesInput(),
    maxUsers: Number(maxUsers.value),
    maxWarehouses: Number(maxWarehouses.value),
    modules: modules.value,
    active: active.value,
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier le plan' : 'Nouveau plan'" @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Nom</Label>
        <Input v-model="name" class="mt-1.5" placeholder="Pro" />
      </div>
      <div v-if="!editing">
        <Label>Code</Label>
        <Input v-model="code" class="mt-1.5" placeholder="pro" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea v-model="description" class="mt-1.5" placeholder="Ce que le plan couvre." />
      </div>
      <div>
        <Label>Tarifs par pays</Label>
        <p class="mt-1 text-[11px] text-muted-foreground">
          Laissez le prix mensuel vide pour ne pas proposer le plan dans un pays. Annuel vide = 10 × le mensuel.
        </p>
        <div class="mt-2 divide-y rounded-md border">
          <div
            v-for="country in BILLING_COUNTRIES"
            :key="country.code"
            class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <p class="col-span-2 text-sm font-medium sm:col-span-1">
              {{ country.flag }} {{ country.name }}
              <span class="block text-[11px] font-normal text-muted-foreground">{{ country.currency }}</span>
            </p>
            <Input
              v-model="prices[country.code].monthly"
              type="number"
              min="0"
              placeholder="Mensuel"
              :aria-label="`Prix mensuel ${country.name} (${country.currency})`"
            />
            <Input
              v-model="prices[country.code].yearly"
              type="number"
              min="0"
              placeholder="Annuel"
              :aria-label="`Prix annuel ${country.name} (${country.currency})`"
              :disabled="prices[country.code].monthly.trim() === ''"
            />
          </div>
        </div>
        <p v-if="!offeredCount" class="mt-1.5 text-[11px] text-red-700">Renseignez le tarif d’au moins un pays.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Utilisateurs max</Label>
          <Input v-model="maxUsers" class="mt-1.5" type="number" />
          <p class="mt-1 text-[11px] text-muted-foreground">0 = illimité</p>
        </div>
        <div>
          <Label>Entrepôts max</Label>
          <Input v-model="maxWarehouses" class="mt-1.5" type="number" />
        </div>
      </div>
      <div>
        <Label>Modules</Label>
        <div class="mt-2 space-y-2">
          <label v-for="item in PLAN_MODULES" :key="item.id" class="flex items-center gap-2 text-sm">
            <Checkbox :model-value="modules.includes(item.id)" @update:model-value="setModule(item.id, $event)" />
            {{ item.label }}
          </label>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
        <div>
          <p class="text-sm font-medium">Plan actif</p>
          <p class="text-xs text-muted-foreground">Proposable aux nouvelles entreprises.</p>
        </div>
        <Switch :checked="active" @update:checked="active = $event" />
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer' }}
      </Button>
    </template>
  </Sheet>
</template>
