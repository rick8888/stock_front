<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import type { Customer } from '@/types'
import type { CustomerInput } from '@/repositories/interfaces'

interface AddressForm {
  key: string
  id?: string
  label: string
  address: string
  city: string
  isDefault: boolean
}

const props = defineProps<{ open: boolean; customer?: Customer | null }>()
const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: CustomerInput }]
}>()

const name = ref('')
const phone = ref('')
const email = ref('')
const ice = ref('')
const notes = ref('')
const addresses = ref<AddressForm[]>([blankAddress()])

const editing = computed(() => Boolean(props.customer))
const canSubmit = computed(
  () =>
    name.value.trim().length > 1 &&
    addresses.value.some((row) => row.label.trim() && row.address.trim() && row.city.trim()),
)

function blankAddress(): AddressForm {
  return {
    key: `adr-${Math.random().toString(36).slice(2, 8)}`,
    label: 'Magasin',
    address: '',
    city: '',
    isDefault: true,
  }
}

function reset() {
  const current = props.customer
  name.value = current?.name ?? ''
  phone.value = current?.phone ?? ''
  email.value = current?.email ?? ''
  ice.value = current?.ice ?? ''
  notes.value = current?.notes ?? ''
  addresses.value = current?.addresses?.length
    ? current.addresses.map((row, index) => ({
        key: row.id,
        id: row.id,
        label: row.label,
        address: row.address,
        city: row.city,
        isDefault: row.isDefault ?? index === 0,
      }))
    : [blankAddress()]
}

watch(
  () => [props.open, props.customer?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

function addAddress() {
  addresses.value.push({ ...blankAddress(), isDefault: false, label: `Adresse ${addresses.value.length + 1}` })
}

function removeAddress(key: string) {
  if (addresses.value.length === 1) return
  addresses.value = addresses.value.filter((row) => row.key !== key)
  if (!addresses.value.some((row) => row.isDefault)) addresses.value[0].isDefault = true
}

function setDefault(key: string) {
  addresses.value = addresses.value.map((row) => ({ ...row, isDefault: row.key === key }))
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    id: props.customer?.id,
    input: {
      name: name.value.trim(),
      phone: phone.value.trim() || undefined,
      email: email.value.trim() || undefined,
      ice: ice.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
      addresses: addresses.value
        .filter((row) => row.label.trim() && row.address.trim() && row.city.trim())
        .map((row) => ({
          id: row.id,
          label: row.label.trim(),
          address: row.address.trim(),
          city: row.city.trim(),
          isDefault: row.isDefault,
        })),
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? 'Modifier le client' : 'Nouveau client'" wide @close="emit('close')">
    <div class="space-y-4">
      <div>
        <Label>Nom</Label>
        <Input v-model="name" class="mt-1.5" placeholder="Pharmacie des Habous" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Téléphone</Label>
          <Input v-model="phone" class="mt-1.5" placeholder="+212…" />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input v-model="email" class="mt-1.5" type="email" />
        </div>
      </div>
      <div>
        <Label>ICE</Label>
        <Input v-model="ice" class="mt-1.5" />
      </div>
      <div>
        <Label>Note</Label>
        <Textarea v-model="notes" class="mt-1.5" :rows="2" />
      </div>
      <section>
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Adresses</h3>
          <Button size="sm" variant="outline" @click="addAddress">
            <Plus class="size-3.5" />
            Ajouter
          </Button>
        </div>
        <div class="mt-2 space-y-2">
          <article v-for="row in addresses" :key="row.key" class="rounded-xl border px-3 py-2.5 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <Input v-model="row.label" class="h-9" placeholder="Libellé" />
              <Button size="icon" variant="destructive" :disabled="addresses.length === 1" @click="removeAddress(row.key)">
                <Trash2 class="size-4" />
              </Button>
            </div>
            <Input v-model="row.address" class="h-9" placeholder="Adresse" />
            <div class="flex items-center gap-2">
              <Input v-model="row.city" class="h-9 flex-1" placeholder="Ville" />
              <Button size="sm" :variant="row.isDefault ? 'default' : 'outline'" @click="setDefault(row.key)">
                {{ row.isDefault ? 'Par défaut' : 'Définir' }}
              </Button>
            </div>
          </article>
        </div>
      </section>
    </div>
    <template #footer>
      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer' }}
      </Button>
    </template>
  </Sheet>
</template>
