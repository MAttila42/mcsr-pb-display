import { getCache, setCache } from './cache'

const API_URL = import.meta.env.VITE_API_URL

const PB_TTL = 15 * 60 * 1000

/**
 * Get a user's PB time in milliseconds (if available). Uses cached value when possible.
 */
export async function getPb(tw: string): Promise<number | undefined> {
  const twKey = tw.toLowerCase()
  const key = `pb:${twKey}`
  const cached = getCache<number | undefined>(key)

  if (cached && !cached.stale)
    return cached.value

  if (cached && cached.stale) {
    ;(async () => {
      const fresh = await fetchPb(twKey)
      setCache(key, fresh, PB_TTL)
    })()
    return cached.value
  }

  const fresh = await fetchPb(twKey)
  setCache(key, fresh, PB_TTL)
  return fresh
}

/**
 * Fetch a single PB directly from the API.
 */
export async function fetchPb(tw: string): Promise<number | undefined> {
  const res = await fetch(`${API_URL}/user/${encodeURIComponent(tw)}/pb`)
  if (!res.ok) {
    if (res.status === 404)
      return undefined
    throw new Error('Failed to fetch PB')
  }
  const text = await res.text()
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
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

export const __pbInternals = { PB_TTL }
