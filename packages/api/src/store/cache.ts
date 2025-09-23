/**
 * Internal representation of a cache entry.
 */
interface CacheEntry<T> {
  /**
   * The cached value.
   */
  value: T
  /**
   * Timestamp after which the value is no longer fresh.
   */
  expiresAt: number
  /**
   * Timestamp after which the value is completely discarded.
   */
  staleUntil: number
}

/**
 * Public result returned from getCache.
 */
export interface CacheResult<T> {
  /**
   * The cached value (undefined if not present or fully expired).
   */
  value: T
  /**
   * True if past primary TTL but before stale TTL (caller should refresh asynchronously).
   */
  stale: boolean
}

const cacheStore = new Map<string, CacheEntry<unknown>>()

/**
 * Options for setCache.
 */
export interface SetCacheOptions {
  /**
   * Primary TTL in ms (fresh window). Default: 15 minutes
   */
  ttl?: number
  /**
   * Secondary TTL in ms (stale window end). Default: ttl * 12 (≈3 hours if ttl default).
   */
  staleTtl?: number
}

/**
 * Store a value in the cache.
 *
 * The value is considered "fresh" until now + ttl.
 *
 * After that and until now + staleTtl the value is returned as stale (caller should trigger refresh).
 *
 * After staleTtl it is removed and not returned.
 */
export function setCache<T>(key: string, value: T, options: number | SetCacheOptions = {}) {
  const normalized: SetCacheOptions = typeof options === 'number'
    ? { ttl: options }
    : options
  const ttl = normalized.ttl ?? 15 * 60 * 1000
  const staleTtl = Math.max(normalized.staleTtl ?? ttl * 12, ttl)
  const now = Date.now()
  cacheStore.set(key, {
    value,
    expiresAt: now + ttl,
    staleUntil: now + staleTtl,
  })
}

/**
 * Retrieve a value from the cache with freshness metadata.
 *
 * Returns undefined if the key is not present or fully expired.
 */
export function getCache<T>(key: string): CacheResult<T> | undefined {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined
  if (!entry)
    return undefined

  const now = Date.now()
  if (now < entry.expiresAt)
    return { value: entry.value, stale: false }
  if (now < entry.staleUntil)
    return { value: entry.value, stale: true }

  cacheStore.delete(key)
  return undefined
}

/**
 * Convenience helper to manually clear a single key.
 */
export function clearCache(key: string) {
  cacheStore.delete(key)
}

/**
 * Convenience helper to clear the entire cache (useful in tests or admin flows).
 */
export function clearAllCache() {
  cacheStore.clear()
}
