import type { RankedUser } from './service/ranked'
import type { UserResponse } from './types/user'
import { eq, sql } from 'drizzle-orm'

import { Elysia, t } from 'elysia'
import { db } from './db'
import { Users } from './db/schema'
import { getRankedUser } from './service/ranked'
import { twitchValidate } from './util'

function createRankedInfo(ranked: Awaited<ReturnType<typeof getRankedUser>>): NonNullable<UserResponse['rankedInfo']> | null {
  if (!ranked)
    return null

  return {
    mcUUID: ranked.uuid,
    mcUsername: ranked.nickname,
    pb: ranked.statistics?.total?.bestTime?.ranked ?? null,
    elo: ranked.eloRate ?? null,
  }
}

function createRankedInfoFromUser(ranked: RankedUser): NonNullable<UserResponse['rankedInfo']> {
  return {
    mcUUID: ranked.uuid,
    mcUsername: ranked.nickname,
    pb: ranked.statistics?.total?.bestTime?.ranked ?? null,
    elo: ranked.eloRate ?? null,
  }
}

function createDbRankedInfo(mcUUID: string, mcUsername: string): NonNullable<UserResponse['rankedInfo']> {
  return {
    mcUUID,
    mcUsername,
    pb: null,
    elo: null,
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

export const user = new Elysia({
  prefix: '/user',
})
  .get('/:tw', async ({ params, request, status }: any) => {
    const tw = params.tw.toLowerCase()
    const logger = createRequestLogger('/user/:tw', { tw })

    const dbUser = await findUserByTwitchLogin(tw)
    if (dbUser && !dbUser.mcUUID)
      return { twLogin: dbUser.twLogin, rankedInfo: null }

    try {
      const ranked = await getRankedUser(tw, request.signal)
      const rankedInfo = createRankedInfo(ranked)

      if (!rankedInfo) {
        if (dbUser?.mcUUID && dbUser.mcUsername)
          return { twLogin: dbUser.twLogin, rankedInfo: createDbRankedInfo(dbUser.mcUUID, dbUser.mcUsername) }

        if (dbUser)
          return { twLogin: dbUser.twLogin, rankedInfo: null }

        return status(404, 'User not found.')
      }

      await upsertUser(tw, rankedInfo.mcUUID, rankedInfo.mcUsername)

      return {
        twLogin: tw,
        rankedInfo,
      }
    }
    catch (error) {
      logger.error('ranked_lookup_failed', error, { tw })

      if (dbUser?.mcUUID && dbUser.mcUsername)
        return { twLogin: dbUser.twLogin, rankedInfo: createDbRankedInfo(dbUser.mcUUID, dbUser.mcUsername) }

      if (dbUser)
        return { twLogin: dbUser.twLogin, rankedInfo: null }

      return status(502, 'Failed to fetch Ranked data.')
    }
  })

  .post('/pbs', async ({ body, request, status }: any) => {
    const logger = createRequestLogger('/user/pbs', {
      bodyType: typeof body,
    })

    let twList: string[]

    try {
      const payload = (typeof body === 'string' ? JSON.parse(body) : body) as string[]
      twList = payload.map(tw => tw.toLowerCase()).slice(0, 200)
    }
    catch (error) {
      logger.error('invalid_payload', error)
      return status(400, 'Invalid payload')
    }

    if (twList.length === 0)
      return status(400, 'Missing array of Twitch usernames.')

    const uniqueTwList = [...new Set(twList)]
    const results: Record<string, number | null> = Object.create(null)

    for (const tw of uniqueTwList) {
      try {
        const ranked = await getRankedUser(tw, request.signal)
        if (!ranked) {
          results[tw] = null
          continue
        }

        results[tw] = ranked.statistics?.total?.bestTime?.ranked ?? null
        await upsertUser(tw, ranked.uuid, ranked.nickname)
      }
      catch (error) {
        logger.error('ranked_fetch_failed', error, { tw })
        results[tw] = null
      }
    }

    return results
  })

  .post('/link/ranked', async ({ headers, request, status }: any) => {
    const logger = createRequestLogger('/user/link/ranked')

    const authHeader = headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return status(401, 'Missing or invalid Authorization header.')

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token)
      return status(401, 'Missing or invalid Authorization header.')

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
    if (!twLogin)
      return status(500, 'Unexpected Twitch response.')

    let ranked
    try {
      ranked = await getRankedUser(twLogin, request.signal)
    }
    catch (error) {
      logger.error('ranked_lookup_failed', error, { twLogin })
      if (error instanceof Error && error.message === 'Ranked user fetch timed out')
        return status(504, 'Timed out while fetching Ranked user.')

      return status(502, 'Failed to fetch Ranked user.')
    }

    if (!ranked) {
      return {
        outcome: 'fallback' as const,
        reason: 'not_found' as const,
        message: 'Could not find a Ranked account linked to your Twitch account.',
      }
    }

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

    return {
      outcome: 'success' as const,
      rankedInfo: createRankedInfoFromUser(ranked),
    }
  }, {
    body: t.Object({
      mcUsername: t.String(),
    }),
  })
