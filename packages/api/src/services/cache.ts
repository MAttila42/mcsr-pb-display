const L1_RETENTION_MS = 4 * 60 * 60 * 1000

const L2_FRESH_WITH_PB_MS = 24 * 60 * 60 * 1000
const L2_FRESH_WITHOUT_PB_MS = 4 * 7 * 24 * 60 * 60 * 1000

const L2_HARD_TTL_WITH_PB_SECONDS = 2 * 7 * 24 * 60 * 60
const L2_HARD_TTL_WITHOUT_PB_SECONDS = 2 * 4 * 7 * 24 * 60 * 60

const LINK_L1_RETENTION_MS = 4 * 60 * 60 * 1000
const LINK_L2_TTL_SECONDS = 24 * 60 * 60

interface PbCacheEntry {
  pb: number | null
  fetchedAt: number
}

interface LinkCacheEntry {
  mcUUID: string
  mcUsername: string
  fetchedAt: number
}

export interface PbCacheLookup {
  status: 'fresh' | 'stale' | 'miss'
  pb: number | null
  fetchedAt: number | null
  source: 'l1' | 'kv' | null
}

const l1PbCache = new Map<string, PbCacheEntry>()
const l1LinkCache = new Map<string, LinkCacheEntry>()

export interface LinkCacheLookup {
  status: 'fresh' | 'miss'
  mcUUID: string
  mcUsername: string
}

let runtimePbCache: CloudflareKVNamespace | undefined

function ensurePbCacheBinding() {
  if (!runtimePbCache)
    throw new Error('PB cache binding not initialized. Did you forget to call setPbCache?')

  return runtimePbCache
}

function keyFor(twLogin: string) {
  return `pb:${twLogin}`
}

function normalizeTwitchLogin(twLogin: string) {
  return twLogin.toLowerCase().trim()
}

function getFreshWindowMs(pb: number | null) {
  return pb === null
    ? L2_FRESH_WITHOUT_PB_MS
    : L2_FRESH_WITH_PB_MS
}

function getHardTtlSeconds(pb: number | null) {
  return pb === null
    ? L2_HARD_TTL_WITHOUT_PB_SECONDS
    : L2_HARD_TTL_WITH_PB_SECONDS
}

function isValidPbCacheEntry(value: unknown): value is PbCacheEntry {
  if (!value || typeof value !== 'object')
    return false

  const record = value as Record<string, unknown>
  const pb = record.pb
  const fetchedAt = record.fetchedAt

  if (pb !== null && typeof pb !== 'number')
    return false

  if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt) || fetchedAt <= 0)
    return false

  return true
}

function isValidLinkCacheEntry(value: unknown): value is LinkCacheEntry {
  if (!value || typeof value !== 'object')
    return false

  const record = value as Record<string, unknown>
  return typeof record.mcUUID === 'string'
    && typeof record.mcUsername === 'string'
    && typeof record.fetchedAt === 'number'
    && Number.isFinite(record.fetchedAt)
}

function readL1FreshEntry(twLogin: string, now: number) {
  const cached = l1PbCache.get(twLogin)
  if (!cached)
    return undefined

  const ageMs = now - cached.fetchedAt
  if (ageMs <= L1_RETENTION_MS)
    return cached

  l1PbCache.delete(twLogin)
  return undefined
}

export function setPbCache(cache: CloudflareKVNamespace) {
  runtimePbCache = cache
}

export async function getCachedPb(twLogin: string): Promise<PbCacheLookup> {
  const normalized = normalizeTwitchLogin(twLogin)
  if (!normalized) {
    return {
      status: 'miss',
      pb: null,
      fetchedAt: null,
      source: null,
    }
  }

  const now = Date.now()

  const l1Fresh = readL1FreshEntry(normalized, now)
  if (l1Fresh) {
    return {
      status: 'fresh',
      pb: l1Fresh.pb,
      fetchedAt: l1Fresh.fetchedAt,
      source: 'l1',
    }
  }

  const kv = ensurePbCacheBinding()
  const kvValue = await kv.get(keyFor(normalized), 'json')

  if (!isValidPbCacheEntry(kvValue)) {
    return {
      status: 'miss',
      pb: null,
      fetchedAt: null,
      source: null,
    }
  }

  l1PbCache.set(normalized, kvValue)

  const ageMs = now - kvValue.fetchedAt
  const hardTtlMs = getHardTtlSeconds(kvValue.pb) * 1000
  if (ageMs > hardTtlMs) {
    l1PbCache.delete(normalized)
    await kv.delete(keyFor(normalized))

    return {
      status: 'miss',
      pb: null,
      fetchedAt: null,
      source: null,
    }
  }

  const freshWindowMs = getFreshWindowMs(kvValue.pb)
  if (ageMs <= freshWindowMs) {
    return {
      status: 'fresh',
      pb: kvValue.pb,
      fetchedAt: kvValue.fetchedAt,
      source: 'kv',
    }
  }

  return {
    status: 'stale',
    pb: kvValue.pb,
    fetchedAt: kvValue.fetchedAt,
    source: 'kv',
  }
}

export async function setCachedPb(twLogin: string, pb: number | null) {
  const normalized = normalizeTwitchLogin(twLogin)
  if (!normalized)
    throw new Error('Cannot cache PB for empty Twitch login')

  const entry: PbCacheEntry = {
    pb,
    fetchedAt: Date.now(),
  }

  l1PbCache.set(normalized, entry)

  const kv = ensurePbCacheBinding()
  const hardTtlSeconds = getHardTtlSeconds(pb)
  await kv.put(keyFor(normalized), JSON.stringify(entry), {
    expirationTtl: hardTtlSeconds,
  })

  return entry
}

function linkKeyFor(twLogin: string) {
  return `link:${twLogin}`
}

export async function getCachedLink(twLogin: string): Promise<LinkCacheLookup | null> {
  const normalized = normalizeTwitchLogin(twLogin)
  if (!normalized)
    return null

  const now = Date.now()
  const l1 = l1LinkCache.get(normalized)
  if (l1 && now - l1.fetchedAt <= LINK_L1_RETENTION_MS)
    return { status: 'fresh', mcUUID: l1.mcUUID, mcUsername: l1.mcUsername }

  const kv = ensurePbCacheBinding()
  const kvValue = await kv.get(linkKeyFor(normalized), 'json')

  if (!isValidLinkCacheEntry(kvValue))
    return null

  l1LinkCache.set(normalized, kvValue)
  return { status: 'fresh', mcUUID: kvValue.mcUUID, mcUsername: kvValue.mcUsername }
}

export async function setCachedLink(twLogin: string, mcUUID: string, mcUsername: string) {
  const normalized = normalizeTwitchLogin(twLogin)
  if (!normalized)
    return

  const entry: LinkCacheEntry = { mcUUID, mcUsername, fetchedAt: Date.now() }
  l1LinkCache.set(normalized, entry)

  const kv = ensurePbCacheBinding()
  await kv.put(linkKeyFor(normalized), JSON.stringify(entry), {
    expirationTtl: LINK_L2_TTL_SECONDS,
  })
}
