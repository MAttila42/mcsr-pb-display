import type { UserResponse } from './types/user'
import { eq, inArray } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { db } from './db'
import { Users } from './db/schema'
import {
  clearCache,
  getCache,
  setCache,
} from './store/cache'
import { rankedUser, rankedUserByIdentifier, twitchValidate } from './util'

export const user = new Elysia({
  aot: false,
  prefix: '/user',
})
  .get('/:tw', async ({ params, status }) => {
    const tw = params.tw.toLowerCase()
    const [user] = await db
      .select()
      .from(Users)
      .where(eq(Users.twLogin, tw))
    if (!user)
      return status(404, 'User not found.')

    const ranked = user.mcUUID ? await rankedUser(user.mcUUID).catch(() => null) : null

    const payload: UserResponse = {
      twLogin: user.twLogin,
      rankedInfo: user.mcUUID
        ? {
            mcUUID: user.mcUUID,
            mcUsername: user.mcUsername!,
            pb: ranked ? ranked.statistics.total.bestTime.ranked : null,
            elo: ranked ? ranked.eloRate : null,
          }
        : null,
    }
    return payload
  })

  .post('/pbs', async ({ body, status }) => {
    try {
      const payload = (typeof body === 'string' ? JSON.parse(body) : body) as string[]
      const twList = payload.map(t => t.toLowerCase()).slice(0, 200)
      if (twList.length === 0)
        return status(400, 'Missing array of Twitch usernames.')

      const users = await db
        .select()
        .from(Users)
        .where(inArray(Users.twLogin, twList))
      const byTw = new Map(users.map(u => [u.twLogin.toLowerCase(), u]))

      const cacheKeyFor = (tw: string) => `pb:${tw}`
      const results: Record<string, number | null> = Object.create(null)

      const set = (tw: string, value: number | null | undefined) => {
        if (value != null)
          setCache(cacheKeyFor(tw), value)
        results[tw] = value ?? null
      }

      const refreshCache = (tw: string, uuid: string) => {
        void (async () => {
          try {
            const ranked = await rankedUser(uuid)
            const pb = ranked?.statistics.total.bestTime.ranked
            if (typeof pb === 'number')
              setCache(cacheKeyFor(tw), pb)
          }
          catch (error) {
            console.error(`Failed to refresh PB cache for ${tw}`, error)
          }
        })()
      }

      const toFetch: { tw: string, uuid: string }[] = []
      for (const tw of twList) {
        const cached = getCache<number>(cacheKeyFor(tw))
        const user = byTw.get(tw)

        if (cached && !cached.stale) {
          results[tw] = cached.value
          continue
        }

        if (cached && cached.stale) {
          results[tw] = cached.value
          if (user?.mcUUID)
            refreshCache(tw, user.mcUUID)
          continue
        }

        if (!user || !user.mcUUID) {
          results[tw] = null
          continue
        }

        toFetch.push({ tw, uuid: user.mcUUID })
      }

      await Promise.all(toFetch.map(async ({ tw, uuid }) => {
        try {
          const ranked = await rankedUser(uuid)
          if (!ranked) {
            results[tw] = null
            return
          }
          const pb = ranked.statistics.total.bestTime.ranked as number | undefined
          set(tw, typeof pb === 'number' ? pb : null)
        }
        catch (error) {
          console.error(`Failed to fetch PB for ${tw}`, error)
          results[tw] ??= null
        }
      }))

      return results
    }
    catch {
      return status(400, 'Invalid payload')
    }
  })

  .post('/link/ranked', async ({ headers, body, status }) => {
    const authHeader = headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return status(401, 'Missing or invalid Authorization header.')

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token)
      return status(401, 'Missing or invalid Authorization header.')

    let twitch: { login: string }
    try {
      twitch = await twitchValidate(token)
    }
    catch {
      return status(401, 'Invalid Twitch token.')
    }

    const twLogin = typeof twitch.login === 'string'
      ? twitch.login.toLowerCase()
      : undefined
    if (!twLogin)
      return status(500, 'Unexpected Twitch response.')

    const payload = (typeof body === 'string' ? JSON.parse(body) : body) as { mcUsername?: string }
    const mcUsername = typeof payload.mcUsername === 'string' ? payload.mcUsername.trim() : ''
    if (!mcUsername)
      return status(400, 'Missing Minecraft username.')

    const ranked = await rankedUserByIdentifier(mcUsername).catch(() => null)
    if (!ranked) {
      return {
        outcome: 'fallback' as const,
        reason: 'not_found' as const,
        message: 'Could not find a Ranked account with that Minecraft username.',
      }
    }

    const twitchConnection = ranked.connections?.twitch
    if (!twitchConnection?.id) {
      return {
        outcome: 'fallback' as const,
        reason: 'no_public_twitch' as const,
        message: 'This Ranked account does not have a publicly visible Twitch link.',
      }
    }

    const linkedTwLogin = twitchConnection.id.toLowerCase()
    if (linkedTwLogin !== twLogin) {
      return {
        outcome: 'fallback' as const,
        reason: 'twitch_mismatch' as const,
        message: `This Ranked account is linked to Twitch user @${twitchConnection.id}, but you are logged in as @${twLogin}.`,
      }
    }

    await db
      .insert(Users)
      .values({
        twLogin,
        mcUUID: ranked.uuid,
        mcUsername: ranked.nickname,
      })
      .onConflictDoUpdate({
        target: Users.twLogin,
        set: {
          mcUUID: ranked.uuid,
          mcUsername: ranked.nickname,
          updatedAt: new Date(),
        },
      })

    clearCache(`pb:${twLogin}`)

    return {
      outcome: 'success' as const,
      rankedInfo: {
        mcUUID: ranked.uuid,
        mcUsername: ranked.nickname,
        pb: ranked.statistics?.total?.bestTime?.ranked ?? null,
        elo: ranked.eloRate ?? null,
      },
    }
  })
