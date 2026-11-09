<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import type { Supplier } from '@/types'
import type { SupplierInput } from '@/repositories/interfaces'

const CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger']
const CATEGORIES = ['Liquides', 'Épicerie', 'Frais', 'Hygiène', 'Divers']
const PAYMENT_TERMS = ['Comptant', '15 jours', '30 jours', '45 jours', '60 jours']

const props = defineProps<{
  open: boolean
  supplier?: Supplier | null
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { id?: string; input: SupplierInput }]
}>()

const name = ref('')
const ice = ref('')
const category = ref('')
const contact = ref('')
const email = ref('')
const phone = ref('')
const city = ref('Casablanca')
const address = ref('')
const leadTimeDays = ref('4')
const paymentTerms = ref('30 jours')
const note = ref('')

const editing = computed(() => Boolean(props.supplier))
const canSubmit = computed(() => name.value.trim().length > 1 && contact.value.trim() && email.value.trim() && phone.value.trim())

function reset() {
  const current = props.supplier
  name.value = current?.name ?? ''
  ice.value = current?.ice ?? ''
  category.value = current?.category ?? ''
  contact.value = current?.contact ?? ''
  email.value = current?.email ?? ''
  phone.value = current?.phone ?? ''
  city.value = current?.city ?? 'Casablanca'
  address.value = current?.address ?? ''
  leadTimeDays.value = String(current?.leadTimeDays ?? 4)
  paymentTerms.value = current?.paymentTerms ?? '30 jours'
  note.value = current?.note ?? ''
}

watch(
  () => [props.open, props.supplier?.id] as const,
  ([open]) => {
    if (open) reset()
  },
)

function submit() {
  if (!canSubmit.value) return
  const days = Number(leadTimeDays.value)
  emit('submit', {
    id: props.supplier?.id,
    input: {
      name: name.value.trim(),
      contact: contact.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      city: city.value,
      address: address.value.trim() || undefined,
      ice: ice.value.trim() || undefined,
      category: category.value || undefined,
      paymentTerms: paymentTerms.value || undefined,
      note: note.value.trim() || undefined,
      leadTimeDays: Number.isFinite(days) && days > 0 ? days : 4,
    },
  })
}
</script>

<template>
  <Sheet :open="open" :title="editing ? supplier?.name : 'Nouveau fournisseur'" wide @close="emit('close')">
    <div class="space-y-5">
      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Identité</h3>
        <div>
          <Label>Raison sociale</Label>
          <Input v-model="name" class="mt-1.5" placeholder="Atlas Distribution" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label>ICE</Label>
            <Input v-model="ice" class="mt-1.5" placeholder="001545278000089" />
          </div>
          <div>
            <Label>Catégorie</Label>
            <select v-model="category" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option value="">Non précisée</option>
              <option v-for="item in CATEGORIES" :key="item" :value="item">{{ item }}</option>
            </select>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Contact</h3>
        <div>
          <Label>Interlocuteur</Label>
          <Input v-model="contact" class="mt-1.5" placeholder="Nom du contact" />
        </div>
        <div>
          <Label>Email</Label>
          <Input v-model="email" type="email" class="mt-1.5" placeholder="contact@fournisseur.ma" />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input v-model="phone" type="tel" class="mt-1.5" placeholder="+212 5 22 00 00 00" />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Adresse</h3>
        <div>
          <Label>Ville</Label>
          <select v-model="city" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
            <option v-for="item in CITIES" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <div>
          <Label>Adresse</Label>
          <Input v-model="address" class="mt-1.5" placeholder="Zone industrielle, rue…" />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold">Conditions</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label>Délai de livraison</Label>
            <div class="mt-1.5 flex items-center gap-2">
              <Input v-model="leadTimeDays" type="number" min="1" />
              <span class="shrink-0 text-xs text-muted-foreground">jours</span>
            </div>
          </div>
          <div>
            <Label>Paiement</Label>
            <select v-model="paymentTerms" class="mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option v-for="item in PAYMENT_TERMS" :key="item" :value="item">{{ item }}</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Notes internes</Label>
          <textarea
            v-model="note"
            rows="3"
            class="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Fiabilité, particularités, horaires…"
          />
        </div>
      </section>

      <p v-if="editing && supplier" class="text-xs text-muted-foreground">
        Fiabilité actuelle {{ supplier.reliability }}% ·
        {{ supplier.status === 'active' ? 'Actif' : 'En attente' }}
      </p>

      <Button class="w-full" :disabled="!canSubmit" @click="submit">
        {{ editing ? 'Enregistrer' : 'Créer' }}
      </Button>
    </div>
  </Sheet>
</template>
