import { apiConfig } from '@/config/api'
import { httpClient } from '@/services/http/http.client'

export interface ContactPayload {
  name: string
  email: string
  company?: string
  phone?: string
  message: string
}

export interface ContactResult {
  ok: true
  message: string
}

/** Demande reçue via le formulaire du site, vue depuis l'espace plateforme. */
export interface ContactMessage {
  id: string
  name: string
  email: string
  company: string | null
  phone: string | null
  message: string
  source: string
  createdAt: string
  handledAt: string | null
}

// Mode démo : les demandes restent en mémoire le temps de la session.
const demoInbox: ContactMessage[] = []

export const contactService = {
  async submit(payload: ContactPayload): Promise<ContactResult> {
    if (!apiConfig.useApi) {
      await new Promise((resolve) => setTimeout(resolve, 450))
      demoInbox.unshift({
        id: `demo-${Date.now()}`,
        name: payload.name,
        email: payload.email,
        company: payload.company ?? null,
        phone: payload.phone ?? null,
        message: payload.message,
        source: 'landing',
        createdAt: new Date().toISOString(),
        handledAt: null,
      })
      return {
        ok: true,
        message: 'Demande enregistrée (mode démo). Nous vous recontactons rapidement.',
      }
    }

    const response = await fetch(`${apiConfig.baseUrl}/contact`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail =
        body?.message ||
        (body?.errors ? Object.values(body.errors).flat().join(' ') : null) ||
        'Envoi impossible. Réessayez dans un instant.'
      throw new Error(String(detail))
    }

    return {
      ok: true,
      message: String(body.message ?? 'Demande reçue. Nous vous recontactons rapidement.'),
    }
  },

  async list(): Promise<ContactMessage[]> {
    if (!apiConfig.useApi) return demoInbox.map((item) => ({ ...item }))
    return httpClient.request<ContactMessage[]>('/platform/contact-messages')
  },

  async setHandled(id: string, handled: boolean): Promise<ContactMessage> {
    if (!apiConfig.useApi) {
      const item = demoInbox.find((entry) => entry.id === id)
      if (!item) throw new Error('Demande introuvable')
      item.handledAt = handled ? new Date().toISOString() : null
      return { ...item }
    }
    return httpClient.request<ContactMessage>(`/platform/contact-messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ handled }),
    })
  },
}
