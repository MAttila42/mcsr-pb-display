import type { UserResponse } from './types/user'
import { eq, inArray } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { db } from './db'
import { Users } from './db/schema'
import {
  getCache,
  setCache,
} from './store/cache'
import { rankedUser } from './util'

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

    const ranked = user.mcUUID ? await rankedUser(user.mcUUID) : null

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
