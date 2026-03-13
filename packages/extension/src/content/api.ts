const API_URL = import.meta.env.VITE_API_URL

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
  const res = await fetch(`${API_URL}/user/pbs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tws.map(t => t.toLowerCase())),
  })
  if (!res.ok)
    throw new Error(`Failed to fetch bulk PBs: ${res.status}`)

  return res.json()
}
