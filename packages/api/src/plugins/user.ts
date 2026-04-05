import { Elysia, t } from 'elysia'
import { setCachedLink } from '../services/cache'
import { getRankedUser } from '../services/ranked'
import {
  createDbRankedInfo,
  createRankedInfo,
  fetchBulkPbs,
  findUserByTwitchLogin,
  MAX_AGE,
  parsePbsUsersQuery,
  upsertUser,
} from '../services/user'

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
    const rankedIdentifier = dbUser?.mcUsername ?? tw

    if (dbUser && !dbUser.mcUUID)
      return { twLogin: dbUser.twLogin, rankedInfo: null }

    try {
      const ranked = await getRankedUser(rankedIdentifier, request.signal, tw)
      const rankedInfo = createRankedInfo(ranked)

      if (!rankedInfo) {
        if (dbUser?.mcUUID && dbUser.mcUsername)
          return { twLogin: dbUser.twLogin, rankedInfo: createDbRankedInfo(dbUser.mcUUID, dbUser.mcUsername) }

        if (dbUser)
          return { twLogin: dbUser.twLogin, rankedInfo: null }

        return status(404, 'User not found.')
      }

      if (tw.toLowerCase() !== rankedInfo.mcUsername.toLowerCase())
        await upsertUser(tw, rankedInfo.mcUUID, rankedInfo.mcUsername)

      await setCachedLink(tw, rankedInfo.mcUUID, rankedInfo.mcUsername)

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

      return status(404, 'User not found.')
    }
  })
