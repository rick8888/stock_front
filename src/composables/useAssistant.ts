import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { uid } from '@/utils/helpers'
import { assistantService, type PageContext } from '@/services/assistant.service'
import type { AssistantMessage, ProposedAction, User } from '@/types'
import { useCurrentUser } from './useAuth'
import { welcomeFor } from '@/mocks/assistant'

const messages = ref<AssistantMessage[]>([])
const loading = ref(false)

function welcomeMessage(user?: User | null): AssistantMessage {
  return {
    id: 'welcome',
    createdAt: new Date().toISOString(),
    ...welcomeFor(user),
  }
}

export function useAssistant() {
  const { currentUser } = useCurrentUser()
  const route = useRoute()
  const error = ref<string | null>(null)

  watch(
    () => currentUser.value?.id,
    (id, prev) => {
      const onlyWelcome =
        !messages.value.length || (messages.value.length === 1 && messages.value[0]?.id === 'welcome')
      if (onlyWelcome) {
        messages.value = [welcomeMessage(currentUser.value)]
        return
      }
      if (prev && id && prev !== id) {
        messages.value = [welcomeMessage(currentUser.value)]
      }
    },
    { immediate: true },
  )

  function page(): PageContext {
    return assistantService.detectPage(route.path)
  }

  async function send(text: string) {
    const user = currentUser.value
    if (!user || !text.trim()) return
    messages.value.push({
      id: uid('msg'),
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    })
    loading.value = true
    error.value = null
    try {
      const reply = await assistantService.ask({ text, user, page: page() })
      messages.value.push(assistantService.toMessage(reply))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Assistant indisponible'
    } finally {
      loading.value = false
    }
  }

  async function confirmAction(action: ProposedAction) {
    const user = currentUser.value
    if (!user) return
    loading.value = true
    try {
      const reply = await assistantService.ask({
        text: 'confirm',
        user,
        page: page(),
        confirm: action,
      })
      messages.value.push(assistantService.toMessage(reply))
    } finally {
      loading.value = false
    }
  }

  function cancelAction() {
    messages.value.push({
      id: uid('msg'),
      role: 'assistant',
      content: 'D’accord, je n’ai rien modifié.',
      createdAt: new Date().toISOString(),
    })
  }

  function reset() {
    messages.value = [welcomeMessage(currentUser.value)]
  }

  return { messages, loading, error, send, confirmAction, cancelAction, reset, refresh: reset }
}
