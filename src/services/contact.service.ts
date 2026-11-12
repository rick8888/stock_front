import { apiConfig } from '@/config/api'

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

export const contactService = {
  async submit(payload: ContactPayload): Promise<ContactResult> {
    if (!apiConfig.useApi) {
      await new Promise((resolve) => setTimeout(resolve, 450))
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
}
