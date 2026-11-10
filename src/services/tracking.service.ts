import { trackingRepository } from '@/repositories'
import type { TrackingPingInput } from '@/types'

export const trackingService = {
  live: () => trackingRepository.live(),
  route: (id: string) => trackingRepository.route(id),
  ping: (input: TrackingPingInput) => trackingRepository.ping(input),
}
