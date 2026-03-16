import type { UserResponse } from './types/user'
import { waitUntil } from 'cloudflare:workers'
import { eq, inArray, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'

import { db } from './db'
import { Users } from './db/schema'
import {
  getRankedCache,
  getRankedCaches,
  setRankedCache,
} from './store/ranked-cache'
import { rankedUser, rankedUserByIdentifier, rankedUserByTwitchLogin, twitchValidate } from './util'

interface RankedSnapshot {
  mcUUID: string
  mcUsername: string
  pb: number | null
  elo: number | null
}

interface UrgentFetchOptions {
  allowStaleOnError?: boolean
  logger?: ReturnType<typeof createRequestLogger>
  source?: string
}

function createRankedSnapshot(twLogin: string, ranked: Awaited<ReturnType<typeof rankedUser>>) {
  if (!ranked)
    return null

  return {
    twLogin,
    mcUUID: ranked.uuid,
    mcUsername: ranked.nickname,
    pb: ranked.statistics?.total?.bestTime?.ranked ?? null,
    elo: ranked.eloRate ?? null,
    fetchedAt: Date.now(),
  } satisfies RankedCacheSnapshot
}

function createRankedInfo(snapshot: RankedSnapshot): NonNullable<UserResponse['rankedInfo']> {
  return {
    mcUUID: snapshot.mcUUID,
    mcUsername: snapshot.mcUsername,
    pb: snapshot.pb,
    elo: snapshot.elo,
  }
}

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

function runInBackground(task: Promise<unknown>) {
  try {
    waitUntil(task)
  }
  catch {
    void task.catch(() => {})
  }
}

async function fetchRankedSnapshotByUuid(
  twLogin: string,
  mcUUID: string,
  signal?: AbortSignal,
): Promise<RankedCacheSnapshot | null> {
  const ranked = await rankedUser(mcUUID, signal)
  return createRankedSnapshot(twLogin, ranked)
}

async function fetchRankedSnapshotByTwitchLogin(
  twLogin: string,
  signal?: AbortSignal,
): Promise<RankedCacheSnapshot | null> {
  const ranked = await rankedUserByTwitchLogin(twLogin, signal)
  return createRankedSnapshot(twLogin, ranked)
}

async function refreshLinkedUserSnapshot(
  twLogin: string,
  mcUUID: string,
  logger?: ReturnType<typeof createRequestLogger>,
) {
  try {
    const snapshot = await fetchRankedSnapshotByUuid(twLogin, mcUUID)
    if (!snapshot)
      return

    await setRankedCache(snapshot)
    await upsertUser(snapshot.twLogin, snapshot.mcUUID, snapshot.mcUsername)
    logger?.log('background_refresh_success', {
      twLogin,
      mcUUID,
    })
  }
  catch (error) {
    logger?.error('background_refresh_failed', error, {
      twLogin,
      mcUUID,
    })
  }
}

async function resolveUrgentLinkedSnapshot(
  twLogin: string,
  mcUUID: string,
  stale: RankedCacheSnapshot | undefined,
  signal?: AbortSignal,
  options: UrgentFetchOptions = {},
): Promise<RankedCacheSnapshot | null> {
  const logger = options.logger
  const source = options.source ?? 'linked_uuid'

  logger?.log('urgent_refresh_started', {
    twLogin,
    source,
    hasStale: Boolean(stale),
  })

  try {
    const snapshot = await fetchRankedSnapshotByUuid(twLogin, mcUUID, signal)
    if (!snapshot) {
      logger?.log('urgent_refresh_empty', {
        twLogin,
        source,
      })
      return stale ?? null
    }

    await setRankedCache(snapshot)
    await upsertUser(snapshot.twLogin, snapshot.mcUUID, snapshot.mcUsername)
    logger?.log('urgent_refresh_success', {
      twLogin,
      source,
    })
    return snapshot
  }
  catch (error) {
    logger?.error('urgent_refresh_failed', error, {
      twLogin,
      source,
      allowStaleOnError: options.allowStaleOnError ?? false,
    })

    if (options.allowStaleOnError && stale)
      return stale

    throw error
  }
}

async function resolveUrgentUnknownUserSnapshot(
  twLogin: string,
  signal?: AbortSignal,
  logger?: ReturnType<typeof createRequestLogger>,
): Promise<RankedCacheSnapshot | null> {
  logger?.log('urgent_lookup_started', { twLogin })

  const snapshot = await fetchRankedSnapshotByTwitchLogin(twLogin, signal)
  if (!snapshot) {
    logger?.log('urgent_lookup_not_found', { twLogin })
    return null
  }

  await upsertUser(snapshot.twLogin, snapshot.mcUUID, snapshot.mcUsername)
  await setRankedCache(snapshot)
  logger?.log('urgent_lookup_success', {
    twLogin,
    mcUUID: snapshot.mcUUID,
  })
  return snapshot
}

export const user = new Elysia({
  prefix: '/user',
})
  .get('/:tw', async ({ params, request, status }: any) => {
    const tw = params.tw.toLowerCase()
    const logger = createRequestLogger('/user/:tw', { tw })
    logger.log('start')

    const [dbUser, cached] = await Promise.all([
      findUserByTwitchLogin(tw),
      getRankedCache(tw),
    ])

    logger.log('lookup_complete', {
      dbUserFound: Boolean(dbUser),
      hasUuid: Boolean(dbUser?.mcUUID),
      cacheState: cached ? (cached.stale ? 'stale' : 'fresh') : 'miss',
    })

    if (dbUser?.mcUUID) {
      if (cached && !cached.stale && cached.snapshot.mcUUID === dbUser.mcUUID) {
        logger.log('cache_hit_fresh', { tw })
        return {
          twLogin: dbUser.twLogin,
          rankedInfo: createRankedInfo(cached.snapshot),
        }
      }

      const stale = cached?.snapshot.mcUUID === dbUser.mcUUID
        ? cached.snapshot
        : undefined

      try {
        const snapshot = await resolveUrgentLinkedSnapshot(
          dbUser.twLogin,
          dbUser.mcUUID,
          stale,
          request.signal,
          {
            allowStaleOnError: true,
            logger,
            source: cached?.stale ? 'stale_cache' : 'cache_miss',
          },
        )

        if (!snapshot) {
          return {
            twLogin: dbUser.twLogin,
            rankedInfo: {
              mcUUID: dbUser.mcUUID,
              mcUsername: dbUser.mcUsername!,
              pb: null,
              elo: null,
            },
          }
        }

        return {
          twLogin: dbUser.twLogin,
          rankedInfo: createRankedInfo(snapshot),
        }
      }
      catch {
        if (stale) {
          logger.log('serving_stale_after_error', { tw })
          return {
            twLogin: dbUser.twLogin,
            rankedInfo: createRankedInfo(stale),
          }
        }

        return {
          twLogin: dbUser.twLogin,
          rankedInfo: {
            mcUUID: dbUser.mcUUID,
            mcUsername: dbUser.mcUsername!,
            pb: null,
            elo: null,
          },
        }
      }
    }

    if (dbUser && !dbUser.mcUUID) {
      logger.log('db_user_without_ranked', { tw })
      return {
        twLogin: dbUser.twLogin,
        rankedInfo: null,
      }
    }

    if (cached && !cached.stale) {
      logger.log('cache_hit_unknown_user', { tw })
      return {
        twLogin: cached.snapshot.twLogin,
        rankedInfo: createRankedInfo(cached.snapshot),
      }
    }

    try {
      const snapshot = await resolveUrgentUnknownUserSnapshot(tw, request.signal, logger)
      if (!snapshot) {
        if (cached?.snapshot) {
          logger.log('serving_stale_unknown_user', { tw })
          return {
            twLogin: cached.snapshot.twLogin,
            rankedInfo: createRankedInfo(cached.snapshot),
          }
        }

        return status(404, 'User not found.')
      }

      return {
        twLogin: snapshot.twLogin,
        rankedInfo: createRankedInfo(snapshot),
      }
    }
    catch (error) {
      logger.error('urgent_lookup_failed', error, { tw })
      if (cached?.snapshot) {
        return {
          twLogin: cached.snapshot.twLogin,
          rankedInfo: createRankedInfo(cached.snapshot),
        }
      }

      return status(502, 'Failed to refresh Ranked data.')
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
      const requestedCount = twList.length
      const users = await db
        .select()
        .from(Users)
        .where(inArray(Users.twLogin, twList))

      const byTw = new Map(users.map(user => [user.twLogin.toLowerCase(), user]))
      const cachedByTw = await getRankedCaches(twList)
      const results: Record<string, number | null> = Object.create(null)

      let freshCacheHits = 0
      let staleCacheHits = 0
      let urgentFetches = 0
      let backgroundRefreshes = 0
      let dbLookups = 0
      let rankedFallbackLookups = 0
      let unmatchedUsers = 0
      let usersWithoutUuid = 0

      for (const tw of twList) {
        let user = byTw.get(tw)
        const cached = cachedByTw.get(tw)

        if (cached && !cached.stale) {
          freshCacheHits += 1
          results[tw] = cached.snapshot.pb
          continue
        }

        if (cached?.stale) {
          staleCacheHits += 1
          results[tw] = cached.snapshot.pb

          if (!user) {
            dbLookups += 1
            user = await findUserByTwitchLogin(tw)
            if (user)
              byTw.set(tw, user)
          }

          const refreshUuid = user?.mcUUID ?? cached.snapshot.mcUUID
          if (refreshUuid) {
            backgroundRefreshes += 1
            runInBackground(refreshLinkedUserSnapshot(tw, refreshUuid, logger))
          }

          continue
        }

        if (!user) {
          dbLookups += 1
          user = await findUserByTwitchLogin(tw)
          if (user)
            byTw.set(tw, user)
        }

        if (!user) {
          try {
            const snapshot = await resolveUrgentUnknownUserSnapshot(tw, request.signal, logger)
            if (snapshot) {
              rankedFallbackLookups += 1
              results[tw] = snapshot.pb
              continue
            }
          }
          catch (error) {
            logger.error('ranked_lookup_failed', error, { tw })
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

        urgentFetches += 1
        try {
          const snapshot = await resolveUrgentLinkedSnapshot(user.twLogin, user.mcUUID, undefined, request.signal, {
            allowStaleOnError: false,
            logger,
            source: 'bulk_cache_miss',
          })
          results[tw] = snapshot?.pb ?? null
        }
        catch (error) {
          logger.error('ranked_fetch_failed', error, {
            tw,
            uuid: user.mcUUID,
          })
          results[tw] = null
        }
      }

      logger.log('success', {
        requestedCount,
        freshCacheHits,
        staleCacheHits,
        urgentFetches,
        backgroundRefreshes,
        dbLookups,
        rankedFallbackLookups,
        unmatchedUsers,
        usersWithoutUuid,
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

    const mcUsername = body.mcUsername.trim()
    if (!mcUsername) {
      logger.log('missing_mc_username', { twLogin })
      return status(400, 'Missing Minecraft username.')
    }

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
        logger.error('ranked_lookup_timeout', error, {
          twLogin,
          mcUsername,
        })
      }
      return useFallback()
    }

    if (!ranked)
      return useFallback()

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

    const snapshot = createRankedSnapshot(twLogin, ranked)
    if (!snapshot)
      return useFallback()

    try {
      await upsertUser(twLogin, ranked.uuid, ranked.nickname)
      await setRankedCache(snapshot)
    }
    catch (error) {
      logger.error('upsert_failed', error, {
        twLogin,
        mcUsername: ranked.nickname,
        mcUUID: ranked.uuid,
      })
      return status(500, 'Failed to save linked account.')
    }

    logger.log('success', {
      twLogin,
      mcUsername: ranked.nickname,
      mcUUID: ranked.uuid,
    })

    return {
      outcome: 'success' as const,
      rankedInfo: createRankedInfo(snapshot),
    }
  }, {
    body: t.Object({
      mcUsername: t.String(),
    }),
  })
