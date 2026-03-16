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

function createRequestLogger(route: string, details: Record<string, unknown> = {}) {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = Date.now()

  const payload = (stage: string, extra: Record<string, unknown> = {}) => ({
    scope: 'user',
    route,
    requestId,
    stage,
    elapsedMs: Date.now() - startedAt,
    ...details,
    ...extra,
  })

  return {
    log(stage: string, extra: Record<string, unknown> = {}) {
      console.warn(payload(stage, extra))
    },
    error(stage: string, error: unknown, extra: Record<string, unknown> = {}) {
      console.error(payload(stage, {
        ...extra,
        error: error instanceof Error ? error.message : String(error),
      }))
    },
  }
}

export const user = new Elysia({
  prefix: '/user',
})
  .get('/:tw', async ({ params, request, status }: any) => {
    const tw = params.tw.toLowerCase()

    const dbUser = await findUserByTwitchLogin(tw)

    if (dbUser?.mcUUID) {
      const ranked = await rankedUser(dbUser.mcUUID, request.signal).catch(() => null)

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

    const ranked = await rankedUserByTwitchLogin(tw, request.signal).catch(() => null)

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

  .post('/pbs', async ({ body, request, status }: any) => {
    const logger = createRequestLogger('/user/pbs', {
      bodyType: typeof body,
    })
    logger.log('start')

    let twList: string[]

    try {
      const payload = (typeof body === 'string' ? JSON.parse(body) : body) as string[]
      twList = payload.map(t => t.toLowerCase()).slice(0, 200)
    }
    catch (error) {
      logger.error('invalid_payload', error)
      return status(400, 'Invalid payload')
    }

    if (twList.length === 0) {
      logger.log('empty_payload')
      return status(400, 'Missing array of Twitch usernames.')
    }

    try {
      logger.log('payload_parsed', {
        requestedCount: twList.length,
      })

      const users = await db
        .select()
        .from(Users)
        .where(inArray(Users.twLogin, twList))
      logger.log('db_users_loaded', {
        requestedCount: twList.length,
        dbUsers: users.length,
      })

      const byTw = new Map(users.map(u => [u.twLogin.toLowerCase(), u]))

      const cacheKeyFor = (tw: string) => `pb:${tw}`
      const results: Record<string, number | null> = Object.create(null)
      let freshCacheHits = 0
      let staleCacheHits = 0
      let dbLookups = 0
      let rankedFallbackLookups = 0
      let unmatchedUsers = 0
      let usersWithoutUuid = 0

      const set = (tw: string, value: number | null | undefined) => {
        if (value != null)
          setCache(cacheKeyFor(tw), value)
        results[tw] = value ?? null
      }

      const refreshCache = (tw: string, uuid: string) => {
        void (async () => {
          try {
            const ranked = await rankedUser(uuid, request.signal)
            const pb = ranked?.statistics.total.bestTime.ranked
            if (typeof pb === 'number')
              setCache(cacheKeyFor(tw), pb)
          }
          catch (error) {
            logger.error('refresh_cache_failed', error, {
              tw,
              uuid,
            })
          }
        })()
      }

      const toFetch: { tw: string, uuid: string }[] = []
      for (const tw of twList) {
        const cached = getCache<number>(cacheKeyFor(tw))
        let user = byTw.get(tw)

        if (cached && !cached.stale) {
          freshCacheHits += 1
          results[tw] = cached.value
          continue
        }

        if (cached && cached.stale) {
          staleCacheHits += 1
          results[tw] = cached.value
          if (user?.mcUUID)
            refreshCache(tw, user.mcUUID)
          continue
        }

        if (!user) {
          dbLookups += 1
          user = await findUserByTwitchLogin(tw)
          if (user)
            byTw.set(tw, user)
        }

        if (!user) {
          const ranked = await rankedUserByTwitchLogin(tw, request.signal).catch((error) => {
            logger.error('ranked_lookup_failed', error, { tw })
            return null
          })

          if (ranked) {
            rankedFallbackLookups += 1

            try {
              await upsertUser(tw, ranked.uuid, ranked.nickname)
            }
            catch (error) {
              logger.error('upsert_from_ranked_failed', error, {
                tw,
                mcUUID: ranked.uuid,
              })
              results[tw] = null
              continue
            }

            const pb = ranked.statistics?.total?.bestTime?.ranked
            set(tw, typeof pb === 'number' ? pb : null)
            continue
          }

          unmatchedUsers += 1
          results[tw] = null
          continue
        }

        if (!user.mcUUID) {
          usersWithoutUuid += 1
          results[tw] = null
          continue
        }

        toFetch.push({ tw, uuid: user.mcUUID })
      }

      logger.log('ranked_fetches_queued', {
        requestedCount: twList.length,
        freshCacheHits,
        staleCacheHits,
        dbLookups,
        rankedFallbackLookups,
        unmatchedUsers,
        usersWithoutUuid,
        toFetchCount: toFetch.length,
      })

      await Promise.all(toFetch.map(async ({ tw, uuid }) => {
        try {
          const ranked = await rankedUser(uuid, request.signal)
          if (!ranked) {
            results[tw] = null
            return
          }
          const pb = ranked.statistics.total.bestTime.ranked as number | undefined
          set(tw, typeof pb === 'number' ? pb : null)
        }
        catch (error) {
          logger.error('ranked_fetch_failed', error, {
            tw,
            uuid,
          })
          results[tw] ??= null
        }
      }))

      logger.log('success', {
        requestedCount: twList.length,
        freshCacheHits,
        staleCacheHits,
        dbLookups,
        rankedFallbackLookups,
        unmatchedUsers,
        usersWithoutUuid,
        toFetchCount: toFetch.length,
        resultCount: Object.keys(results).length,
      })

      return results
    }
    catch (error) {
      logger.error('failed', error, {
        requestedCount: twList.length,
      })
      return status(500, 'Failed to fetch PBs.')
    }
  })

  .post('/link/ranked', async ({ headers, body, request, status }: any) => {
    const logger = createRequestLogger('/user/link/ranked')
    logger.log('start')

    const authHeader = headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.log('missing_authorization')
      return status(401, 'Missing or invalid Authorization header.')
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      logger.log('empty_authorization_token')
      return status(401, 'Missing or invalid Authorization header.')
    }

    let twitch: { login: string }
    try {
      twitch = await twitchValidate(token, request.signal)
    }
    catch (error) {
      logger.error('twitch_validate_failed', error)
      if (error instanceof Error && error.message === 'Twitch validate timed out')
        return status(504, 'Timed out while validating Twitch token.')

      return status(401, 'Invalid Twitch token.')
    }

    const twLogin = typeof twitch.login === 'string'
      ? twitch.login.toLowerCase()
      : undefined
    if (!twLogin) {
      logger.log('unexpected_twitch_response')
      return status(500, 'Unexpected Twitch response.')
    }

    logger.log('twitch_validated', { twLogin })

    const mcUsername = body.mcUsername.trim()
    if (!mcUsername) {
      logger.log('missing_mc_username', { twLogin })
      return status(400, 'Missing Minecraft username.')
    }

    logger.log('ranked_lookup_started', {
      twLogin,
      mcUsername,
    })

    const useFallback = () => {
      logger.log('ranked_not_found', {
        twLogin,
        mcUsername,
      })
      return {
        outcome: 'fallback' as const,
        reason: 'not_found' as const,
        message: 'Could not find a Ranked account with that Minecraft username.',
      }
    }

    let ranked
    try {
      ranked = await rankedUserByIdentifier(mcUsername, request.signal)
    }
    catch (error) {
      logger.error('ranked_lookup_failed', error, {
        twLogin,
        mcUsername,
      })
      if (error instanceof Error && error.message === 'Ranked user fetch timed out') {
        logger.error('ranked_lookup_timeout', {
          twLogin,
          mcUsername,
        })
      }
      useFallback()
    }

    if (!ranked) {
      useFallback()
      return
    }

    const twitchConnection = ranked.connections?.twitch
    if (!twitchConnection?.id) {
      logger.log('ranked_missing_public_twitch', {
        twLogin,
        mcUsername,
        mcUUID: ranked.uuid,
      })
      return {
        outcome: 'fallback' as const,
        reason: 'no_public_twitch' as const,
        message: 'This Ranked account does not have a publicly visible Twitch link.',
      }
    }

    const linkedTwLogin = twitchConnection.id.toLowerCase()
    if (linkedTwLogin !== twLogin) {
      logger.log('ranked_twitch_mismatch', {
        twLogin,
        linkedTwLogin,
        mcUsername,
        mcUUID: ranked.uuid,
      })
      return {
        outcome: 'fallback' as const,
        reason: 'twitch_mismatch' as const,
        message: `This Ranked account is linked to Twitch user @${twitchConnection.id}, but you are logged in as @${twLogin}.`,
      }
    }

    logger.log('upsert_started', {
      twLogin,
      mcUsername: ranked.nickname,
      mcUUID: ranked.uuid,
    })

    try {
      await upsertUser(twLogin, ranked.uuid, ranked.nickname)
    }
    catch (error) {
      logger.error('upsert_failed', error, {
        twLogin,
        mcUsername: ranked.nickname,
        mcUUID: ranked.uuid,
      })
      return status(500, 'Failed to save linked account.')
    }

    clearCache(`pb:${twLogin}`)

    logger.log('success', {
      twLogin,
      mcUsername: ranked.nickname,
      mcUUID: ranked.uuid,
    })

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
