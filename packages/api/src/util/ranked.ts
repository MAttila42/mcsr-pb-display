import { createThrottledQueue } from './throttle'

const RANKED_USER = 'https://mcsrranked.com/api/users'

const REQUESTS_PER_WINDOW = 500
const WINDOW_MS = 10 * 60 * 1000
const INTERVAL_MS = Math.ceil(WINDOW_MS / REQUESTS_PER_WINDOW)
const runRankedRequest = createThrottledQueue(INTERVAL_MS)

export function rankedUser(uuid: string) {
  return runRankedRequest(() => rawRankedUser(uuid))
}

async function rawRankedUser(uuid: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(`${RANKED_USER}/${uuid}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok)
      throw new Error('Ranked user fetch failed')
    const json = await res.json()
    if (json.status === 'error')
      return null
    return json.data
  }
  catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError')
      throw new Error('Ranked user fetch timed out')

    throw err
  }
}
