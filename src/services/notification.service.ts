import { notificationRepository } from '@/repositories'

export const notificationService = {
  list: () => notificationRepository.list(),
  markRead: (id: string) => notificationRepository.markRead(id),
  markAllRead: () => notificationRepository.markAllRead(),
}
