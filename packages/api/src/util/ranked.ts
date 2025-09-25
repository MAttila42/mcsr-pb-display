import { createThrottledQueue } from './throttle'

const RANKED_USER = 'https://mcsrranked.com/api/users'

/**
 * Raw fetcher for a single ranked user.
 */
async function rawRankedUser(uuid: string) {
  const res = await fetch(`${RANKED_USER}/${uuid}`)
  if (!res.ok)
    throw new Error('Ranked user fetch failed')
  const json = await res.json()
  if (json.status === 'error')
    return null
  return json.data
}

/**
 * Throttled wrapper to respect \~500 req / 10 min (\~1 request / 1.2s).
 *
 * We serialize calls and ensure at least INTERVAL_MS delay between successive requests.
 */
const INTERVAL_MS = 1250
const runRankedRequest = createThrottledQueue(INTERVAL_MS)

export function rankedUser(uuid: string) {
  return runRankedRequest(() => rawRankedUser(uuid))
}
