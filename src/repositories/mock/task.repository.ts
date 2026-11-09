import type { Task } from '@/types'
import type { TaskRepository } from '@/repositories/interfaces'
import { uid } from '@/utils/helpers'
import { db, mutate, withLatency } from './db'

export class MockTaskRepository implements TaskRepository {
  list() {
    return withLatency(() => db().tasks)
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
      Object.assign(task, input)
      return task
    })
  }
}
