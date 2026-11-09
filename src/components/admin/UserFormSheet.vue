<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import type { Role, RoleKey, User, Warehouse } from '@/types'
import type { UserInput } from '@/repositories/interfaces'

const props = defineProps<{
  open: boolean
  user?: User | null
  roles: Role[]
  warehouses: Warehouse[]
  error?: string | null
  driverPhone?: string
  companyName?: string
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: UserInput }]
}>()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const role = ref<RoleKey>('WAREHOUSE_MANAGER')
const title = ref('')
const warehouseIds = ref<string[]>([])
const phone = ref('')
const titleTouched = ref(false)

const editing = computed(() => Boolean(props.user))
const needsWarehouse = computed(() =>
  ['WAREHOUSE_MANAGER', 'DISPATCHER', 'DRIVER'].includes(role.value),
)
const canSubmit = computed(() => {
  if (firstName.value.trim().length < 2 || lastName.value.trim().length < 2) return false
  if (needsWarehouse.value && !warehouseIds.value.length) return false
  if (role.value === 'DRIVER' && phone.value.trim().length < 6 && !editing.value) return false
  return true
})

function defaultTitle(key: RoleKey) {
  return props.roles.find((item) => item.key === key)?.name ?? key
}

function reset() {
  const current = props.user
  firstName.value = current?.firstName ?? ''
  lastName.value = current?.lastName ?? ''
  email.value = current?.email ?? ''
  password.value = ''
  role.value = current?.role ?? 'WAREHOUSE_MANAGER'
  title.value = current?.title ?? defaultTitle(role.value)
  warehouseIds.value = current?.warehouseIds ? [...current.warehouseIds] : []
  phone.value = current?.role === 'DRIVER' ? (props.driverPhone ?? '') : ''
  titleTouched.value = Boolean(current?.title)
}

watch(
  () => [props.open, props.user?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

function onRoleChange() {
  if (!titleTouched.value) title.value = defaultTitle(role.value)
}

function toggleWarehouse(id: string, checked: boolean) {
  if (checked) {
    if (!warehouseIds.value.includes(id)) warehouseIds.value = [...warehouseIds.value, id]
    return
  }
  warehouseIds.value = warehouseIds.value.filter((item) => item !== id)
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.user?.id,
    input: {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim() || undefined,
      password: password.value.trim() || undefined,
      role: role.value,
      title: title.value.trim() || defaultTitle(role.value),
      warehouseIds: warehouseIds.value,
      phone: role.value === 'DRIVER' ? phone.value.trim() || undefined : undefined,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'" @close="emit('close')">
    <div class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Prénom</Label>
          <Input v-model="firstName" class="mt-1.5" placeholder="Leila" />
        </div>
        <div>
          <Label>Nom</Label>
          <Input v-model="lastName" class="mt-1.5" placeholder="Benjelloun" />
        </div>
      </div>
      <div>
        <Label>Email</Label>
        <Input v-model="email" class="mt-1.5" type="email" placeholder="leila.benjelloun@bravo.stock" />
        <p class="mt-1.5 text-xs text-muted-foreground">
          Laissé vide, un email de connexion est généré.
        </p>
      </div>
      <div>
        <Label>{{ editing ? 'Nouveau mot de passe' : 'Mot de passe' }}</Label>
        <Input v-model="password" class="mt-1.5" type="password" placeholder="demo" />
        <p class="mt-1.5 text-xs text-muted-foreground">
          {{ editing ? 'Laisser vide pour conserver le mot de passe actuel.' : 'Par défaut : demo.' }}
        </p>
      </div>
      <div>
        <Label>Entreprise</Label>
        <p class="mt-1.5 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          {{ companyName || 'Non rattachée' }}
        </p>
        <p class="mt-1.5 text-xs text-muted-foreground">
          Le compte est rattaché à l’entreprise de l’administrateur qui le crée.
        </p>
      </div>
      <div>
        <Label>Rôle</Label>
        <select v-model="role" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm" @change="onRoleChange">
          <option v-for="item in roles" :key="item.key" :value="item.key">{{ item.name }}</option>
        </select>
      </div>
      <div>
        <Label>Intitulé</Label>
        <Input v-model="title" class="mt-1.5" placeholder="Administratrice" @input="titleTouched = true" />
      </div>
      <div v-if="role === 'DRIVER'">
        <Label>Téléphone</Label>
        <Input v-model="phone" class="mt-1.5" placeholder="+212 661 00 00 00" />
      </div>
      <div>
        <Label>Entrepôts</Label>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ needsWarehouse ? 'Au moins un site est requis pour ce rôle.' : 'Laisser vide = tous les sites.' }}
        </p>
        <div class="mt-2 space-y-2">
          <label
            v-for="warehouse in warehouses"
            :key="warehouse.id"
            class="flex items-center gap-2 text-sm"
          >
            <Checkbox
              :model-value="warehouseIds.includes(warehouse.id)"
              @update:model-value="toggleWarehouse(warehouse.id, $event)"
            />
            {{ warehouse.name }}
          </label>
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer le compte' }}
      </Button>
    </template>
  </Sheet>
</template>
