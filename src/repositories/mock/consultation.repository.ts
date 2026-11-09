import type { Consultation } from '@/types'
import type { ConsultationRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

export class MockConsultationRepository implements ConsultationRepository {
  list() {
    return withLatency(() => db().consultations ?? [])
  }

  create(input: Omit<Consultation, 'id' | 'createdAt'>) {
    return mutate(() => {
      if (!db().consultations) db().consultations = []
      const seq = db().consultations.length + 12
      const consultation: Consultation = {
        id: uid('cs'),
        createdAt: new Date().toISOString(),
        ...input,
        code: input.code ?? `CS-2026-${String(seq).padStart(5, '0')}`,
      }
      db().consultations.unshift(consultation)
      db().notifications.unshift({
        id: uid('ntf'),
        title: 'Consultation envoyée',
        message: `${consultation.code} — ${consultation.supplierIds.length} fournisseurs sollicités.`,
        createdAt: consultation.createdAt,
        read: false,
        type: 'info',
      })
      return consultation
    })
  }

  update(id: string, input: Partial<Consultation>) {
    return mutate(() => {
      const consultation = (db().consultations ?? []).find((item) => item.id === id)
      if (!consultation) throw new Error('Consultation introuvable')
      Object.assign(consultation, input)
      return consultation
    })
  }
}
