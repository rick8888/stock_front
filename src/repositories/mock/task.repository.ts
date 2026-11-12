import type { Task } from '@/types'
import type { TaskBoard, TaskRepository } from '@/repositories/interfaces'
import { opsToday, rebaseDemoIso, uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'
import { useAuthStore } from '@/stores/auth'

function byDue(a: Task, b: Task) {
  const rank = { high: 0, medium: 1, low: 2 }
  if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority]
  return a.dueAt.localeCompare(b.dueAt)
}

function buildBoard(tasks: Task[]): TaskBoard {
  const today = opsToday()
  const open = tasks.filter((item) => item.status !== 'done')
  const overdue = open.filter((item) => item.dueAt.slice(0, 10) < today).sort(byDue)
  const todayItems = open.filter((item) => item.dueAt.slice(0, 10) === today).sort(byDue)
  const later = open.filter((item) => item.dueAt.slice(0, 10) > today).sort(byDue)
  const done = tasks.filter((item) => item.status === 'done').sort((a, b) => b.dueAt.localeCompare(a.dueAt))

  return {
    tasks,
    counts: {
      open: open.length,
      today: todayItems.length,
      overdue: overdue.length,
      done: done.length,
    },
    groups: [
      { id: 'overdue', title: 'En retard', items: overdue },
      { id: 'today', title: 'Aujourd’hui', items: todayItems },
      { id: 'later', title: 'Plus tard', items: later },
    ].filter((group) => group.items.length),
    done,
  }
}

export class MockTaskRepository implements TaskRepository {
  list() {
    return withLatency(() => {
      const userId = useAuthStore().currentUser?.id
      return db()
        .tasks.filter((task) => !userId || task.assigneeId === userId)
        .map((task) => ({
          ...task,
          dueAt: rebaseDemoIso(task.dueAt) ?? task.dueAt,
        }))
    })
  }

  board() {
    return withLatency(async () => buildBoard(await this.list()))
  }

  create(input: Omit<Task, 'id'>) {
    return mutate(() => {
      const task: Task = { id: uid('tsk'), ...input }
      db().tasks.unshift(task)
      db().planning.unshift({
        id: uid('pl'),
        title: task.title,
        date: task.dueAt,
        type: 'task',
        relatedId: task.id,
      })
      db().notifications.unshift({
        id: uid('ntf'),
        title: 'Nouvelle tâche',
        message: task.title,
        createdAt: new Date().toISOString(),
        read: false,
        type: 'info',
      })
      return task
    })
  }

  update(id: string, input: Partial<Task>) {
    return mutate(() => {
      const task = db().tasks.find((item) => item.id === id)
      if (!task) throw new Error('Tâche introuvable')
      const userId = useAuthStore().currentUser?.id
      if (userId && task.assigneeId !== userId) {
        const role = useAuthStore().currentUser?.role
        if (!role || !['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
          throw new Error('Cette tâche ne vous est pas assignée.')
        }
      }
      Object.assign(task, input)
      return task
    })
  }
}
