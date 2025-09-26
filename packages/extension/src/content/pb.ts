import { getSessionCache, setSessionCache } from './cache'

const API_URL = import.meta.env.VITE_API_URL

const PB_TTL = 15 * 60 * 1000
const BATCH_WINDOW_MS = 1000

const pendingNames: string[] = []
const pendingResolvers = new Map<string, Array<(value: number | undefined) => void>>()
const inFlight = new Map<string, Promise<number | undefined>>()
let lastMessageTimestamp = 0
let batchTimer: number | undefined

/**
 * Get a user's PB time in milliseconds (if available). Uses cached value when possible.
 */
export async function getPb(tw: string): Promise<number | undefined> {
  const twKey = tw.toLowerCase()
  const key = `pb:${twKey}`
  const cached = getSessionCache<number | undefined>(key)

  if (cached && !cached.stale)
    return cached.value

  if (cached && cached.stale) {
    void queueBulkFetch(twKey).catch((err) => {
      console.error('[mcsr-pb-display] bulk refresh failed', err)
    })
    return cached.value
  }

  return queueBulkFetch(twKey)
}

/**
 * Fetch multiple PBs in a single request.
 */
export async function fetchBulkPbs(tws: string[]): Promise<Record<string, number | null>> {
  const res = await fetch(`${API_URL}/user/pbs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tws.map(t => t.toLowerCase())),
  })
  if (!res.ok)
    throw new Error('Failed to fetch bulk PBs')
  const json = await res.json() as Record<string, number | null>
  return json
}

export function formatTime(ms: number): string {
  const date = new Date(ms)
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')
  const formatted = hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
  return formatted
}

function queueBulkFetch(twKey: string): Promise<number | undefined> {
  const existing = inFlight.get(twKey)
  if (existing)
    return existing

  const promise = new Promise<number | undefined>((resolve) => {
    const resolvers = pendingResolvers.get(twKey) ?? []
    resolvers.push(resolve)
    pendingResolvers.set(twKey, resolvers)
  })

  inFlight.set(twKey, promise)

  if (!pendingNames.includes(twKey))
    pendingNames.push(twKey)

  const now = Date.now()
  if (lastMessageTimestamp === 0) {
    lastMessageTimestamp = now
    void flushPending()
  }
  else {
    const delta = now - lastMessageTimestamp
    if (delta < BATCH_WINDOW_MS) {
      if (batchTimer === undefined) {
        const remaining = Math.max(0, BATCH_WINDOW_MS - delta)
        batchTimer = window.setTimeout(() => {
          batchTimer = undefined
          void flushPending()
        }, remaining)
      }
    }
    else {
      lastMessageTimestamp = now
      void flushPending()
    }
  }

  return promise
}

async function flushPending() {
  if (pendingNames.length === 0)
    return

  if (batchTimer !== undefined) {
    window.clearTimeout(batchTimer)
    batchTimer = undefined
  }

  const queued = pendingNames.splice(0, pendingNames.length)
  const uniqueNames = Array.from(new Set(queued))
  if (uniqueNames.length === 0)
    return

  const resolverMap = new Map<string, Array<(value: number | undefined) => void>>()
  for (const name of uniqueNames) {
    const resolvers = pendingResolvers.get(name)
    if (resolvers && resolvers.length > 0)
      resolverMap.set(name, resolvers)
    pendingResolvers.delete(name)
  }

  try {
    const result = await fetchBulkPbs(uniqueNames)
    for (const name of uniqueNames) {
      const raw = result[name] ?? null
      const value = raw === null ? undefined : raw
      setSessionCache(`pb:${name}`, value, PB_TTL)
      const resolvers = resolverMap.get(name)
      resolvers?.forEach(resolve => resolve(value))
      inFlight.delete(name)
    }
  }
  catch (err) {
    console.error('[mcsr-pb-display] failed to fetch PBs', err)
  }
  finally {
    lastMessageTimestamp = Date.now()
  }
}
