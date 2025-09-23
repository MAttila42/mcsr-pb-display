/**
 * Session data stored in-memory.
 *
 * @property `token`: Twitch OAuth token.
 * @property `ttl`: timestamp after which the session is no longer valid.
 */
export interface SessionData {
  token: string
  ttl: number
}

const sessionStore = new Map<string, SessionData>()

/**
 * Store session data.
 *
 * Note: sessions are single-use and removed on getSession.
 */
export function setSession(id: string, data: SessionData) {
  sessionStore.set(id, data)
}

/**
 * Retrieve and remove session data.
 *
 * Returns undefined if the session does not exist or is expired.
 */
export function getSession(id: string): SessionData | undefined {
  const sessionData = sessionStore.get(id)
  sessionStore.delete(id)

  if (!sessionData || sessionData.ttl < Date.now())
    return undefined
  return sessionData
}
