<script setup lang="ts">
import { ref } from 'vue'
import { FileDown, MessageCircle } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import WhatsAppShareSheet from '@/components/documents/WhatsAppShareSheet.vue'
import { downloadOfficialPdf, type DocContact } from '@/utils/documents'

const props = defineProps<{
  filename: string
  message: string
  contacts?: DocContact[]
}>()

const waOpen = ref(false)

function onPdf() {
  downloadOfficialPdf(props.filename)
}

function onWhatsApp() {
  downloadOfficialPdf(props.filename)
  waOpen.value = true
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <Button type="button" variant="outline" class="flex-1" @click="onPdf">
      <FileDown class="size-3.5" />
      Télécharger PDF
    </Button>
    <Button type="button" variant="outline" class="flex-1" @click="onWhatsApp">
      <MessageCircle class="size-3.5" />
      WhatsApp
    </Button>
    <slot />
    <WhatsAppShareSheet
      :open="waOpen"
      :contacts="contacts ?? []"
      :message="message"
      :filename="filename"
      @close="waOpen = false"
    />
  </div>
</template>
