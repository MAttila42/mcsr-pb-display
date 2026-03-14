import { DurableObject } from 'cloudflare:workers'

export const RANKED_REQUESTS_PER_WINDOW = 500
export const RANKED_WINDOW_MS = 10 * 60 * 1000
export const RANKED_INTERVAL_MS = Math.ceil(RANKED_WINDOW_MS / RANKED_REQUESTS_PER_WINDOW)

const GLOBAL_RANKED_THROTTLE = 'global'

export class RankedThrottle extends DurableObject<CloudflareEnv> {
  private nextAvailableAt = 0

  async acquire(request: RankedThrottleRequest = {}) {
    const now = Date.now()
    const scheduledAt = Math.max(this.nextAvailableAt, now)
    const waitMs = Math.max(scheduledAt - now, 0)

    this.nextAvailableAt = scheduledAt + RANKED_INTERVAL_MS

    if (waitMs > 0)
      await new Promise<void>(resolve => setTimeout(resolve, waitMs))

    console.warn({
      scope: 'ranked-throttle',
      identifier: request.identifier,
      waitMs,
    })
  }
}

export function getRankedThrottle(env: CloudflareEnv) {
  return env.RANKED_THROTTLE.getByName(GLOBAL_RANKED_THROTTLE)
}
