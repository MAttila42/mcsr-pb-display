import { DurableObject } from 'cloudflare:workers'

export const RANKED_REQUESTS_PER_WINDOW = 500
export const RANKED_WINDOW_MS = 10 * 60 * 1000
export const RANKED_INTERVAL_MS = Math.ceil(RANKED_WINDOW_MS / RANKED_REQUESTS_PER_WINDOW)

const GLOBAL_RANKED_THROTTLE = 'global'
const CACHE_KEY_PREFIX = 'ranked-cache:'

export class RankedThrottle extends DurableObject<CloudflareEnv> {
  private nextAvailableAt = 0

  private getCacheKey(twLogin: string) {
    return `${CACHE_KEY_PREFIX}${twLogin.toLowerCase()}`
  }

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

  async getCachedSnapshot(twLogin: string) {
    return await this.ctx.storage.get<RankedCacheSnapshot>(this.getCacheKey(twLogin)) ?? null
  }

  async getCachedSnapshots(twLogins: string[]) {
    const entries = await Promise.all(twLogins.map(async (twLogin) => {
      const snapshot = await this.getCachedSnapshot(twLogin)
      return snapshot ? [twLogin.toLowerCase(), snapshot] as const : null
    }))

    return Object.fromEntries(entries.filter(entry => entry !== null))
  }

  async setCachedSnapshot(snapshot: RankedCacheSnapshot) {
    await this.ctx.storage.put(this.getCacheKey(snapshot.twLogin), {
      ...snapshot,
      twLogin: snapshot.twLogin.toLowerCase(),
    })
  }

  async deleteCachedSnapshot(twLogin: string) {
    await this.ctx.storage.delete(this.getCacheKey(twLogin))
  }
}

export function getRankedThrottle(env: CloudflareEnv) {
  return env.RANKED_THROTTLE.getByName(GLOBAL_RANKED_THROTTLE)
}
