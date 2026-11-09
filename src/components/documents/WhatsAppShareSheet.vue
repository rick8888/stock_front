<script setup lang="ts">
import { ref, watch } from 'vue'
import Sheet from '@/components/ui/Sheet.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { shareOfficialPdf, type DocContact } from '@/utils/documents'

const props = defineProps<{
  open: boolean
  contacts: DocContact[]
  message: string
  filename: string
}>()

const emit = defineEmits<{ close: [] }>()

const phone = ref('')
const text = ref('')
const sending = ref(false)

watch(
  () => [props.open, props.message, props.contacts] as const,
  ([open]) => {
    if (!open) return
    text.value = props.message
    phone.value = props.contacts[0]?.phone ?? ''
  },
)

async function send() {
  if (!phone.value.replace(/\D/g, '').length) return
  sending.value = true
  try {
    await shareOfficialPdf({ phone: phone.value, message: text.value, filename: props.filename })
    emit('close')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Sheet :open="open" :busy="sending" title="Envoyer sur WhatsApp" @close="emit('close')">
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Le PDF est téléchargé. Sur téléphone, WhatsApp peut le joindre ; sur ordinateur, glissez le fichier dans la conversation.
      </p>
      <div v-if="contacts.length" class="flex flex-wrap gap-2">
        <button
          v-for="item in contacts"
          :key="item.phone + item.label"
          type="button"
          class="rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
          :class="phone === item.phone ? 'border-primary bg-primary/5' : ''"
          @click="phone = item.phone"
        >
          <span class="block font-medium">{{ item.label }}</span>
          <span class="block text-xs text-muted-foreground">{{ item.hint ?? item.phone }}</span>
        </button>
      </div>
      <div>
        <Label>Numéro</Label>
        <Input v-model="phone" class="mt-1.5" placeholder="+212 6…" />
      </div>
      <div>
        <Label>Message</Label>
        <textarea
          v-model="text"
          rows="8"
          class="mt-1.5 w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
    <template #footer>
      <Button class="w-full" :loading="sending" :disabled="!phone.replace(/\D/g, '').length" @click="send">
        Envoyer (PDF + WhatsApp)
      </Button>
    </template>
  </Sheet>
</template>
