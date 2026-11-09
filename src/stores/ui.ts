import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const assistantOpen = ref(false)
  const commandOpen = ref(false)

  function openAssistant() {
    assistantOpen.value = true
  }

  function closeAssistant() {
    assistantOpen.value = false
  }

  return {
    sidebarOpen,
    assistantOpen,
    commandOpen,
    openAssistant,
    closeAssistant,
  }
})
