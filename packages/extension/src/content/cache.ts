/**
 * Internal representation of a session cache entry.
 */
interface SessionCacheEntry<T> {
  value: T
  /** Timestamp after which the value is no longer fresh. */
  expiresAt: number
}

/**
 * Public result returned from getSessionCache.
 */
export interface CacheResult<T> {
  /** The cached value (undefined if not present). */
  value: T
  /** True if past TTL (stale), caller should refresh asynchronously. */
  stale: boolean
}

const sessionCacheStore = new Map<string, SessionCacheEntry<unknown>>()

/** Options for setSessionCache. */
export interface SetCacheOptions {
  /** TTL in ms. Default: 15 minutes */
  ttl?: number
}

/** Store a value in the long-lived (session) cache. */
export function setSessionCache<T>(key: string, value: T, options: number | SetCacheOptions = {}) {
  const normalized: SetCacheOptions = typeof options === 'number' ? { ttl: options } : options
  const ttl = normalized.ttl ?? 15 * 60 * 1000
  sessionCacheStore.set(key, { value, expiresAt: Date.now() + ttl })
}

/** Retrieve a value from the long-lived (session) cache. */
export function getSessionCache<T>(key: string): CacheResult<T> | undefined {
  const entry = sessionCacheStore.get(key) as SessionCacheEntry<T> | undefined
  if (!entry)
    return undefined
  const now = Date.now()
  const stale = now >= entry.expiresAt
  return { value: entry.value, stale }
}

/** Clear a single session cache key. */
export function clearSessionCache(key: string) {
  sessionCacheStore.delete(key)
}

/** Clear all session-scoped cached values. */
export function clearAllSessionCache() {
  sessionCacheStore.clear()
}
