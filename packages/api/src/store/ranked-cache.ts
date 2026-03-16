import { getRankedThrottle } from '../ranked-throttle'
import { getWorkerEnv } from '../worker-env'

const RANKED_CACHE_TTL_MS = 60 * 60 * 1000
const RANKED_CACHE_STALE_TTL_MS = 12 * 60 * 60 * 1000

export interface RankedCacheResult {
  snapshot: RankedCacheSnapshot
  stale: boolean
}

const localSnapshots = new Map<string, RankedCacheSnapshot>()

function getCacheStore() {
  const env = getWorkerEnv()
  if (!env)
    return undefined

  return getRankedThrottle(env)
}

function normalizeTwLogin(twLogin: string) {
  return twLogin.toLowerCase()
}

function toCacheResult(snapshot: RankedCacheSnapshot): RankedCacheResult | undefined {
  const ageMs = Date.now() - snapshot.fetchedAt
  if (ageMs >= RANKED_CACHE_STALE_TTL_MS)
    return undefined

  return {
    snapshot,
    stale: ageMs >= RANKED_CACHE_TTL_MS,
  }
}

export async function getRankedCache(twLogin: string): Promise<RankedCacheResult | undefined> {
  const normalized = normalizeTwLogin(twLogin)
  const store = getCacheStore()
  const snapshot = store
    ? await store.getCachedSnapshot(normalized)
    : localSnapshots.get(normalized) ?? null
  if (!snapshot)
    return undefined

  const result = toCacheResult(snapshot)
  if (!result && !store)
    localSnapshots.delete(normalized)

  return result
}

export async function getRankedCaches(twLogins: string[]): Promise<Map<string, RankedCacheResult>> {
  const normalized = [...new Set(twLogins.map(normalizeTwLogin))]
  const results = new Map<string, RankedCacheResult>()

  const store = getCacheStore()
  const snapshots = store
    ? await store.getCachedSnapshots(normalized)
    : Object.fromEntries(normalized.flatMap((twLogin) => {
        const snapshot = localSnapshots.get(twLogin)
        return snapshot ? [[twLogin, snapshot]] : []
      }))

  for (const twLogin of normalized) {
    const snapshot = snapshots[twLogin]
    if (!snapshot)
      continue

    const result = toCacheResult(snapshot)
    if (result)
      results.set(twLogin, result)
    else if (!store)
      localSnapshots.delete(twLogin)
  }

  return results
}

export async function setRankedCache(snapshot: RankedCacheSnapshot) {
  const normalizedSnapshot = {
    ...snapshot,
    twLogin: normalizeTwLogin(snapshot.twLogin),
  }

  const store = getCacheStore()
  if (store) {
    await store.setCachedSnapshot(normalizedSnapshot)
    return
  }

  localSnapshots.set(normalizedSnapshot.twLogin, normalizedSnapshot)
}

export async function clearRankedCache(twLogin: string) {
  const normalized = normalizeTwLogin(twLogin)
  const store = getCacheStore()
  if (store) {
    await store.deleteCachedSnapshot(normalized)
    return
  }

  localSnapshots.delete(normalized)
}
