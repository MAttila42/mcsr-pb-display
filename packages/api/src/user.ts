import { eq } from 'drizzle-orm'
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
