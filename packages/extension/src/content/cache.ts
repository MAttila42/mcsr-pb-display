/**
 * Internal representation of a cache entry.
 */
interface CacheEntry<T> {
  value: T
  /** Timestamp after which the value is no longer fresh. */
  expiresAt: number
}

/**
 * Public result returned from getCache.
 */
export interface CacheResult<T> {
  /** The cached value (undefined if not present). */
  value: T
  /** True if past TTL (stale), caller should refresh asynchronously. */
  stale: boolean
}

const cacheStore = new Map<string, CacheEntry<unknown>>()

/** Options for setCache. */
export interface SetCacheOptions {
  /** TTL in ms. Default: 15 minutes */
  ttl?: number
}

/** Store a value in the cache with a single TTL window. */
export function setCache<T>(key: string, value: T, options: number | SetCacheOptions = {}) {
  const normalized: SetCacheOptions = typeof options === 'number' ? { ttl: options } : options
  const ttl = normalized.ttl ?? 15 * 60 * 1000
  cacheStore.set(key, { value, expiresAt: Date.now() + ttl })
}

/** Retrieve a value from the cache. Returns value and stale flag; undefined if missing. */
export function getCache<T>(key: string): CacheResult<T> | undefined {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined
  if (!entry)
    return undefined
  const now = Date.now()
  const stale = now >= entry.expiresAt
  return { value: entry.value, stale }
}

/** Clear a single key. */
export function clearCache(key: string) {
  cacheStore.delete(key)
}

/** Clear all cached values. */
export function clearAllCache() {
  cacheStore.clear()
}
