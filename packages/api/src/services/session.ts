export interface SessionData {
  token: string
  ttl: number
}

const sessionStore = new Map<string, SessionData>()

export function setSession(id: string, data: SessionData) {
  sessionStore.set(id, data)
}

export function getSession(id: string): SessionData | undefined {
  const sessionData = sessionStore.get(id)
  sessionStore.delete(id)

  if (!sessionData || sessionData.ttl < Date.now())
    return undefined
  return sessionData
}
