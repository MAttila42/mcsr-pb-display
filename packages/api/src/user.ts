import type { UserResponse } from './types/user'
import { eq, inArray, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from './db'
import { Users } from './db/schema'
import {
  clearCache,
  getCache,
  setCache,
} from './store/cache'
import { rankedUser, rankedUserByIdentifier, rankedUserByTwitchLogin, twitchValidate } from './util'

async function upsertUser(twLogin: string, mcUUID: string, mcUsername: string) {
  await db
    .insert(Users)
    .values({
      twLogin,
      mcUUID,
      mcUsername,
    })
    .onConflictDoUpdate({
      target: Users.twLogin,
      set: {
        mcUUID,
        mcUsername,
        updatedAt: new Date(),
      },
    })
}

async function findUserByTwitchLogin(twLogin: string) {
  const [user] = await db
    .select()
    .from(Users)
    .where(eq(Users.twLogin, twLogin))

  if (user)
    return user

  const [caseInsensitiveUser] = await db
    .select()
    .from(Users)
    .where(sql`lower(${Users.twLogin}) = ${twLogin}`)

  if (!caseInsensitiveUser)
    return undefined

  if (caseInsensitiveUser.twLogin === twLogin)
    return caseInsensitiveUser

  try {
    await db
      .update(Users)
      .set({
        twLogin,
        updatedAt: new Date(),
      })
      .where(eq(Users.twLogin, caseInsensitiveUser.twLogin))

    return {
      ...caseInsensitiveUser,
      twLogin,
    }
  }
  catch {
    return caseInsensitiveUser
  }
}

export const user = new Elysia({
  aot: false,
  prefix: '/user',
})
  .get('/:tw', async ({ params, status }) => {
    const tw = params.tw.toLowerCase()

    const dbUser = await findUserByTwitchLogin(tw)

    if (dbUser?.mcUUID) {
      const ranked = await rankedUser(dbUser.mcUUID).catch(() => null)

      const payload: UserResponse = {
        twLogin: dbUser.twLogin,
        rankedInfo: {
          mcUUID: dbUser.mcUUID,
          mcUsername: dbUser.mcUsername!,
          pb: ranked ? ranked.statistics.total.bestTime.ranked : null,
          elo: ranked ? ranked.eloRate : null,
        },
      }
      return payload
    }

    if (dbUser && !dbUser.mcUUID) {
      return {
        twLogin: dbUser.twLogin,
        rankedInfo: null,
      }
    }

    const ranked = await rankedUserByTwitchLogin(tw).catch(() => null)

    if (!ranked)
      return status(404, 'User not found.')

    await upsertUser(tw, ranked.uuid, ranked.nickname)

    return {
      twLogin: tw,
      rankedInfo: {
        mcUUID: ranked.uuid,
        mcUsername: ranked.nickname,
        pb: ranked.statistics?.total?.bestTime?.ranked ?? null,
        elo: ranked.eloRate ?? null,
      },
    }
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
          catch {}
        })()
      }

      const toFetch: { tw: string, uuid: string }[] = []
      for (const tw of twList) {
        const cached = getCache<number>(cacheKeyFor(tw))
        let user = byTw.get(tw)

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

        if (!user) {
          user = await findUserByTwitchLogin(tw)
          if (user)
            byTw.set(tw, user)
        }

        if (!user) {
          const ranked = await rankedUserByTwitchLogin(tw).catch(() => null)

          if (ranked) {
            await upsertUser(tw, ranked.uuid, ranked.nickname)

            const pb = ranked.statistics?.total?.bestTime?.ranked
            set(tw, typeof pb === 'number' ? pb : null)
            continue
          }

          results[tw] = null
          continue
        }

        if (!user.mcUUID) {
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
        catch {
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

    const mcUsername = body.mcUsername.trim()
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

    await upsertUser(twLogin, ranked.uuid, ranked.nickname)

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
  }, {
    body: t.Object({
      mcUsername: t.String(),
    }),
  })
