import { Elysia, t } from 'elysia'
import { getRankedUser } from './service/ranked'
import {
  createDbRankedInfo,
  createRankedInfo,
  createRankedInfoFromUser,
  fetchBulkPbs,
  findUserByTwitchLogin,
  MAX_AGE,
  parsePbsUsersQuery,
  upsertUser,
} from './service/user'
import { twitchValidate } from './util'

export const user = new Elysia({
  prefix: '/user',
})
  .get('/pbs', async ({ query, request, set, status }: any) => {
    const twList = parsePbsUsersQuery(query.users)

    if (twList.length === 0)
      return status(400, 'Missing users query parameter.')

    const results = await fetchBulkPbs(twList, request.signal)
    set.headers['Cache-Control'] = `public, max-age=${MAX_AGE}`
    return results
  }, {
    query: t.Object({
      users: t.String(),
    }),
  })

  .get('/:tw', async ({ params, request, status }: any) => {
    const tw = params.tw.toLowerCase()

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
    catch {
      if (dbUser?.mcUUID && dbUser.mcUsername)
        return { twLogin: dbUser.twLogin, rankedInfo: createDbRankedInfo(dbUser.mcUUID, dbUser.mcUsername) }

      if (dbUser)
        return { twLogin: dbUser.twLogin, rankedInfo: null }

      return status(502, 'Failed to fetch Ranked data.')
    }
  })

  .post('/link/ranked', async ({ headers, request, status }: any) => {
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
    catch {
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
