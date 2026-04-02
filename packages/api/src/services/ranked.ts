import { setCachedPb } from './cache'

const RANKED_USER = 'https://mcsrranked.com/api/users'
const RANKED_TIMEOUT_MS = 5000

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

export async function getRankedUser(identifier: string, signal?: AbortSignal, expectedTwitchLogin?: string): Promise<RankedUser | null> {
  const normalizedIdentifier = identifier.toLowerCase()
  const normalizedExpectedTwitchLogin = (expectedTwitchLogin ?? identifier).toLowerCase()
  const request = createTimeoutSignal(RANKED_TIMEOUT_MS, signal)

  try {
    const response = await fetch(`${RANKED_USER}/${encodeURIComponent(normalizedIdentifier)}`, {
      signal: request.signal,
    })

    if (response.status === 404)
      return null

    if (!response.ok)
      throw new Error('Ranked user fetch failed')

    const json = await response.json() as {
      status?: string
      data?: RankedUser
    }

    if (json.status === 'error' || !json.data)
      return null

    const twitchConnection = json.data.connections?.twitch
    if (!twitchConnection?.id)
      return null

    const normalizedTwitchConnectionId = twitchConnection.id.toLowerCase()
    if (normalizedTwitchConnectionId !== normalizedExpectedTwitchLogin)
      return null

    if (!json.data.uuid || !json.data.nickname)
      return null

    const pb = json.data.statistics?.total?.bestTime?.ranked ?? null
    await setCachedPb(normalizedExpectedTwitchLogin, pb)

    return json.data
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError' && request.timedOut())
      throw new Error('Ranked user fetch timed out')

    throw error
  }
  finally {
    request.cleanup()
  }
}
