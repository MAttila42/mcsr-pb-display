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
 * Throttled wrapper to respect ~500 req / 10 min (~1 request / 1.2s).
 * We serialize calls and ensure at least INTERVAL_MS delay between successive requests.
 */
const INTERVAL_MS = 1250
let lastRun = 0
let chain: Promise<unknown> = Promise.resolve()

export function rankedUser(uuid: string) {
  const task = async () => {
    const now = Date.now()
    const wait = Math.max(INTERVAL_MS - (now - lastRun), 0)
    if (wait > 0)
      await new Promise(resolve => setTimeout(resolve, wait))
    try {
      const data = await rawRankedUser(uuid)
      return data
    }
    finally {
      lastRun = Date.now()
    }
  }

  // Chain tasks to enforce serialization and spacing
  // Capture this task's promise before updating the chain so callers get their own promise
  const next = chain.then(task, task)
  chain = next.catch(() => { /* keep chain alive */ })
  return next
}
