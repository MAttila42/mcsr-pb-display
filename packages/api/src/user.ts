import { eq, inArray } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { db } from './db'
import { Users } from './db/schema'
import {
  getCache,
  setCache,
} from './store/cache'
import { rankedUser } from './util/ranked'

export const user = new Elysia({
  aot: false,
  prefix: '/user',
})
  .get('/:tw/pb', async ({ params, status }) => {
    const tw = params.tw.toLowerCase()
    const [user] = await db
      .select()
      .from(Users)
      .where(eq(Users.twitchLogin, tw))

    if (!user)
      return status(404, 'User not found.')
    if (!user.minecraftUUID)
      return status(404, 'User has no linked account.')

    const cacheKey = `pb:${user.twitchLogin}`
    const cached = getCache<number>(cacheKey)

    if (cached && !cached.stale)
      return cached.value

    if (cached && cached.stale) {
      ;(async () => {
        const ranked = await rankedUser(user.minecraftUUID)
        if (!ranked)
          return
        const newPb = ranked.statistics.total.bestTime.ranked
        setCache(cacheKey, newPb)
      })()
      return cached.value
    }

    const ranked = await rankedUser(user.minecraftUUID)
    if (!ranked)
      return status(404, 'User has no ranked stats.')
    const pb = ranked.statistics.total.bestTime.ranked
    setCache(cacheKey, pb)
    return pb
  })
  .post('/pbs', async ({ body, status }) => {
    try {
      const payload = (typeof body === 'string' ? JSON.parse(body) : body) as { tw: string[] }
      const twList = Array.isArray(payload?.tw) ? payload.tw.map(t => t.toLowerCase()).slice(0, 200) : []
      if (twList.length === 0)
        return status(400, 'Missing tw array')

      const users = await db
        .select()
        .from(Users)
        .where(inArray(Users.twitchLogin, twList))
      const byTw = new Map(users.map(u => [u.twitchLogin.toLowerCase(), u]))

      const results: Record<string, number | null> = Object.create(null)

      const set = (tw: string, value: number | null | undefined) => {
        const cacheKey = `pb:${tw}`
        if (value != null)
          setCache(cacheKey, value)
        results[tw] = value ?? null
      }

      const staleToRefresh: { tw: string, uuid: string }[] = []
      for (const tw of twList) {
        const cacheKey = `pb:${tw}`
        const cached = getCache<number>(cacheKey)
        if (cached && !cached.stale) {
          results[tw] = cached.value
          continue
        }

        const user = byTw.get(tw)
        if (!user || !user.minecraftUUID) {
          results[tw] = null
          continue
        }

        if (cached && cached.stale) {
          results[tw] = cached.value
          staleToRefresh.push({ tw, uuid: user.minecraftUUID })
          continue
        }

        staleToRefresh.push({ tw, uuid: user.minecraftUUID })
      }

      for (const item of staleToRefresh) {
        try {
          const ranked = await rankedUser(item.uuid)
          if (!ranked) {
            set(item.tw, null)
            continue
          }
          const pb = ranked.statistics.total.bestTime.ranked as number | undefined
          set(item.tw, typeof pb === 'number' ? pb : null)
        }
        catch {
          if (results[item.tw] == null)
            results[item.tw] = null
        }
      }

      return results
    }
    catch {
      return status(400, 'Invalid payload')
    }
  })
