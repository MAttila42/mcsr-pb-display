import { getRankedThrottle, RANKED_INTERVAL_MS } from '../ranked-throttle'
import { getWorkerEnv } from '../worker-env'

import { createThrottledQueue } from './throttle'

const RANKED_USER = 'https://mcsrranked.com/api/users'
const runLocalRankedRequest = createThrottledQueue(RANKED_INTERVAL_MS)

export async function rankedUser(uuid: string, signal?: AbortSignal) {
  await waitForRankedSlot({ identifier: uuid })
  return rawRankedUser(uuid, signal)
}

export interface RankedUser {
  uuid: string
  nickname: string
  eloRate: number
  connections: Record<string, { id: string, name: string }>
  statistics: {
    total: {
      bestTime: {
        ranked: number | null
      }
    }
  }
}

export async function rankedUserByIdentifier(identifier: string, signal?: AbortSignal): Promise<RankedUser | null> {
  await waitForRankedSlot({ identifier })
  return rawRankedUserByIdentifier(identifier, signal)
}

export async function rankedUserByTwitchLogin(twLogin: string, signal?: AbortSignal): Promise<RankedUser | null> {
  const normalized = twLogin.toLowerCase()

  let ranked
  try {
    ranked = await rankedUserByIdentifier(normalized, signal)
  }
  catch {
    return null
  }

  if (!ranked)
    return null

  const twitchConnection = ranked.connections?.twitch
  if (!twitchConnection?.id)
    return null
  if (twitchConnection.id.toLowerCase() !== normalized)
    return null
  if (!ranked.uuid || !ranked.nickname)
    return null

  return ranked
}

async function waitForRankedSlot(request: RankedThrottleRequest) {
  const env = getWorkerEnv()

  if (env) {
    await getRankedThrottle(env).acquire(request)
    return
  }

  await runLocalRankedRequest(() => undefined)
}

function createTimeoutSignal(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort('timeout')
  }, timeoutMs)
  const abort = () => controller.abort()

  if (signal?.aborted)
    controller.abort()
  else
    signal?.addEventListener('abort', abort, { once: true })

  return {
    signal: controller.signal,
    timedOut() {
      return timedOut
    },
    cleanup() {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abort)
    },
  }
}

async function rawRankedUserByIdentifier(identifier: string, signal?: AbortSignal): Promise<RankedUser | null> {
  const request = createTimeoutSignal(5000, signal)

  try {
    const res = await fetch(`${RANKED_USER}/${encodeURIComponent(identifier)}`, {
      signal: request.signal,
    })
    if (!res.ok)
      throw new Error('Ranked user fetch failed')
    const json = await res.json()
    if (json.status === 'error')
      return null
    return json.data as RankedUser
  }
  catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && request.timedOut())
      throw new Error('Ranked user fetch timed out')

    throw err
  }
  finally {
    request.cleanup()
  }
}

async function rawRankedUser(uuid: string, signal?: AbortSignal) {
  const request = createTimeoutSignal(5000, signal)

  try {
    const res = await fetch(`${RANKED_USER}/${uuid}`, {
      signal: request.signal,
    })
    if (!res.ok)
      throw new Error('Ranked user fetch failed')
    const json = await res.json()
    if (json.status === 'error')
      return null
    return json.data
  }
  catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && request.timedOut())
      throw new Error('Ranked user fetch timed out')

    throw err
  }
  finally {
    request.cleanup()
  }
}
