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
import type { PlanModule, SubscriptionPlan } from '@/types'
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
const monthlyPrice = ref('2490')
const yearlyPrice = ref('24900')
const maxUsers = ref('25')
const maxWarehouses = ref('5')
const modules = ref<PlanModule[]>(['stock', 'procurement'])
const active = ref(true)

const editing = computed(() => Boolean(props.plan))
const canSubmit = computed(() => name.value.trim().length > 1 && Number(monthlyPrice.value) >= 0)

function setModule(id: PlanModule, on: boolean) {
  if (on && !modules.value.includes(id)) modules.value = [...modules.value, id]
  else if (!on) modules.value = modules.value.filter((item) => item !== id)
}

function reset() {
  name.value = props.plan?.name ?? ''
  code.value = props.plan?.code ?? ''
  description.value = props.plan?.description ?? ''
  monthlyPrice.value = String(props.plan?.monthlyPrice ?? 2490)
  yearlyPrice.value = String(props.plan?.yearlyPrice ?? 24900)
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
    monthlyPrice: Number(monthlyPrice.value),
    yearlyPrice: Number(yearlyPrice.value),
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
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Prix mensuel (MAD)</Label>
          <Input v-model="monthlyPrice" class="mt-1.5" type="number" />
        </div>
        <div>
          <Label>Prix annuel (MAD)</Label>
          <Input v-model="yearlyPrice" class="mt-1.5" type="number" />
        </div>
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
