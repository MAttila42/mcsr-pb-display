const API_URL = import.meta.env.VITE_API_URL
const API_TIMEOUT_MS = 30000

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const externalSignal = init.signal

  const abort = () => controller.abort()

  if (externalSignal?.aborted)
    controller.abort()
  else
    externalSignal?.addEventListener('abort', abort, { once: true })

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  }
  finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abort)
  }
}

export interface RankedInfo {
  mcUUID: string
  mcUsername: string
  pb: number | null
  elo: number | null
}

export interface UserResponse {
  twLogin: string
  rankedInfo: RankedInfo | null
}

export async function fetchUser(tw: string): Promise<UserResponse> {
  const res = await fetch(`${API_URL}/user/${encodeURIComponent(tw.toLowerCase())}`)
  if (!res.ok)
    throw new Error(`Failed to fetch user: ${res.status}`)

  return res.json()
}

export async function fetchBulkPbs(tws: string[]): Promise<Record<string, number | null>> {
  let res: Response

  try {
    res = await fetchWithTimeout(`${API_URL}/user/pbs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tws.map(t => t.toLowerCase())),
    })
  }
  catch (err) {
    if (err instanceof Error && err.name === 'AbortError')
      throw new Error('PB request timed out')

    throw err
  }

  if (!res.ok)
    throw new Error(`Failed to fetch bulk PBs: ${res.status}`)

  return res.json()
}
