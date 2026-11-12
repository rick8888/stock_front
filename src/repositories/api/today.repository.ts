import { httpClient } from '@/services/http/http.client'
import type { TodayBrief } from '@/services/today.service'
import type { TodayRepository } from '@/repositories/interfaces'

export class ApiTodayRepository implements TodayRepository {
  brief(): Promise<TodayBrief> {
    return httpClient.request('/ops/today')
  }
}
