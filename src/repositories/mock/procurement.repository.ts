import type { ProcurementRequest } from '@/types'
import type { ProcurementRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'
import { requestCode } from '@/lib/utils'
import { ALERT_ROLES } from '@/config/alerts'

export class MockProcurementRepository implements ProcurementRepository {
  list() {
    return withLatency(() => db().procurementRequests)
  }

  create(input: Omit<ProcurementRequest, 'id' | 'createdAt' | 'status'> & { status?: ProcurementRequest['status'] }) {
    return mutate(() => {
      const seq = 100 + db().procurementRequests.length + 1
      const now = new Date().toISOString()
      const status = input.status ?? 'submitted'
      const request: ProcurementRequest = {
        id: uid('pr'),
        code: input.code ?? requestCode(`pr-${seq}`),
        createdAt: now,
        submittedAt: status === 'draft' ? undefined : now,
        status,
        requesterId: input.requesterId,
        warehouseId: input.warehouseId,
        items: input.items,
        note: input.note,
        priority: input.priority ?? 'medium',
        service: input.service,
      }
      db().procurementRequests.unshift(request)
      if (status !== 'draft') {
        db().alerts.unshift({
          id: uid('al'),
          title: request.code ?? 'Nouvelle demande',
          message: request.note || 'Une demande d’achat a été créée.',
          severity: request.priority === 'high' ? 'warning' : 'info',
          createdAt: now,
          read: false,
          domain: 'procurement',
          relatedId: request.id,
          warehouseId: request.warehouseId,
          roles: ALERT_ROLES.daSubmitted,
        })
        db().notifications.unshift({
          id: uid('ntf'),
          title: 'Nouvelle demande d’achat',
          message: request.note || `${request.code} a été soumise.`,
          createdAt: now,
          read: false,
          type: 'info',
        })
      }
      return request
    })
  }

  updateStatus(id: string, status: ProcurementRequest['status'], extras?: Partial<ProcurementRequest>) {
    return mutate(() => {
      const request = db().procurementRequests.find((item) => item.id === id)
      if (!request) throw new Error('Demande introuvable')
      request.status = status
      if (extras) Object.assign(request, extras)
      if (status === 'submitted' && !request.submittedAt) {
        request.submittedAt = extras?.submittedAt ?? new Date().toISOString()
      }
      if ((status === 'approved' || status === 'rejected') && !request.decidedAt) {
        request.decidedAt = extras?.decidedAt ?? new Date().toISOString()
      }
      if (status === 'approved' && extras?.assigneeId && extras.handedOffAt) {
        const assignee = db().users.find((item) => item.id === extras.assigneeId)
        const toBuyer = extras.assignedRole === 'PROCUREMENT'
        const code = request.code ?? request.id.toUpperCase()
        db().alerts.unshift({
          id: uid('al'),
          title: `${code} validée`,
          message: toBuyer
            ? `Transmise à ${assignee?.firstName ?? 'l’acheteur'} pour approvisionnement.`
            : `Transmise à ${assignee?.firstName ?? 'le magasin'} pour sortie de stock.`,
          severity: 'info',
          createdAt: new Date().toISOString(),
          read: false,
          domain: 'procurement',
          relatedId: request.id,
          warehouseId: request.warehouseId,
          userId: extras.assigneeId,
          roles: toBuyer ? ALERT_ROLES.daToBuyer : ALERT_ROLES.daToStore,
        })
        db().notifications.unshift({
          id: uid('ntf'),
          title: toBuyer ? 'Nouvelle DA à traiter' : 'Sortie de stock à faire',
          message: `${code} vient d’être validée.`,
          createdAt: new Date().toISOString(),
          read: false,
          type: 'info',
        })
      }
      return request
    })
  }
}
