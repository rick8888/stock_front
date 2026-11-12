import type { AttentionItem, PlanningEvent, Task } from '@/types'
import { todayRepository } from '@/repositories'

export interface TodaySignal {
  id: string
  label: string
  value: string | number
  trend: string
  trendUp: boolean
  tone: 'critical' | 'warning' | 'info' | 'success'
}

export interface StockWatchRow {
  productId: string
  warehouseId: string
  productName: string
  warehouseName: string
  quantity: number
  days: number
  tone: 'critical' | 'warning' | 'info'
}

export interface TodayBrief {
  queue: AttentionItem[]
  toHandle: AttentionItem[]
  toWatch: AttentionItem[]
  recommendations: AttentionItem[]
  tasks: Task[]
  activity: AttentionItem[]
  signals: TodaySignal[]
  watchStock: StockWatchRow[]
  prompts: string[]
  agenda: PlanningEvent[]
  unreadAlerts: number
  criticalAlerts: number
  openTasksCount: number
  criticalStockCount: number
  actionableCount: number
}

/** Brief ops : 100 % backend (`GET /ops/today`) — aucun calcul métier ici. */
export const todayService = {
  brief: (): Promise<TodayBrief> => todayRepository.brief(),
}
