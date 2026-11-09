import { taskRepository, alertRepository, planningRepository, userRepository, roleRepository } from '@/repositories'
import { alertVisibleTo } from './alert.visibility'
import type { Task, User } from '@/types'

export const taskService = {
  list: () => taskRepository.list(),
  create: (input: Omit<Task, 'id'>) => taskRepository.create(input),
  update: (id: string, input: Partial<Task>) => taskRepository.update(id, input),
}

export const alertService = {
  async list(user?: User | null) {
    const alerts = await alertRepository.list()
    if (!user) return alerts
    return alerts.filter((alert) => alertVisibleTo(alert, user))
  },
  markRead: (id: string) => alertRepository.markRead(id),
}

export const planningService = {
  list: (from?: string, to?: string) => planningRepository.list(from, to),
}

export const adminService = {
  users: () => userRepository.list(),
  roles: () => roleRepository.list(),
  createUser: userRepository.create.bind(userRepository),
  updateUser: userRepository.update.bind(userRepository),
}
