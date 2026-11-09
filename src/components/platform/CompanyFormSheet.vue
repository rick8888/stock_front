<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import type { BillingInterval, Company, SubscriptionPlan } from '@/types'
import type { CompanyInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  company?: Company | null
  plans: SubscriptionPlan[]
}>()

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
const planId = ref('')
const interval = ref<BillingInterval>('monthly')

const editing = computed(() => Boolean(props.company))
const offerPlans = computed(() => props.plans.filter((plan) => plan.active || plan.id === planId.value))

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
  planId.value = props.plans.find((plan) => plan.active)?.id ?? props.plans[0]?.id ?? ''
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
          <Label>ICE</Label>
          <Input v-model="ice" class="mt-1.5" placeholder="001845632000089" />
        </div>
        <div>
          <Label>Ville</Label>
          <Input v-model="city" class="mt-1.5" placeholder="Casablanca" />
        </div>
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
              {{ plan.name }} · {{ plan.monthlyPrice }} MAD / mois
            </option>
          </select>
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
