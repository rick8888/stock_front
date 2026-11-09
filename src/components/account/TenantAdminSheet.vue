<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import type { User } from '@/types'
import type { UserInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  user?: User | null
  error?: string | null
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: UserInput }]
}>()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const title = ref('')

const editing = computed(() => Boolean(props.user))
const canSubmit = computed(
  () => firstName.value.trim().length >= 2 && lastName.value.trim().length >= 2,
)

function reset() {
  firstName.value = props.user?.firstName ?? ''
  lastName.value = props.user?.lastName ?? ''
  email.value = props.user?.email ?? ''
  password.value = ''
  title.value = props.user?.title ?? 'Administrateur'
}

watch(
  () => [props.open, props.user?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.user?.id,
    input: {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim() || undefined,
      password: password.value.trim() || undefined,
      role: 'ADMIN',
      title: title.value.trim() || 'Administrateur',
      warehouseIds: [],
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier l’administrateur' : 'Nouvel administrateur'" @close="emit('close')">
    <div class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Prénom</Label>
          <Input v-model="firstName" class="mt-1.5" />
        </div>
        <div>
          <Label>Nom</Label>
          <Input v-model="lastName" class="mt-1.5" />
        </div>
      </div>
      <div>
        <Label>Email</Label>
        <Input v-model="email" class="mt-1.5" type="email" placeholder="prenom.nom@bravo.stock" />
      </div>
      <div>
        <Label>{{ editing ? 'Nouveau mot de passe' : 'Mot de passe' }}</Label>
        <Input v-model="password" class="mt-1.5" type="password" :placeholder="editing ? 'Laisser vide pour ne pas changer' : 'demo'" />
      </div>
      <div>
        <Label>Intitulé</Label>
        <Input v-model="title" class="mt-1.5" placeholder="Administrateur" />
      </div>
      <p class="text-xs text-muted-foreground">
        Ce compte aura le rôle administrateur : utilisateurs, entrepôts et catalogue. Pas de rôle métier, pas de second propriétaire.
      </p>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer' }}
      </Button>
    </template>
  </Sheet>
</template>
