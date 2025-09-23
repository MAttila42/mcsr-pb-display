import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { db } from './db'
import { Users } from './db/schema'
import {
  // minecraftProfileLookup,
  rankedUser,
} from './util/minecraft'

export const user = new Elysia({
  aot: false,
  prefix: '/user',
})
// .get('/:tw', async ({ params }) => {
//   const tw = params.tw.toLowerCase()
//   const [user] = await db
//     .select()
//     .from(Users)
//     .where(eq(Users.twitchLogin, tw))
//   const mcProfile = await minecraftProfileLookup(user.minecraftUUID)

  //   return {
  //     twitchLogin: user.twitchLogin,
  //     linkedAccounts: [
  //       ...(user.minecraftUUID
  //         ? [{
  //             type: 'minecraft',
  //             username: mcProfile.name,
  //           }]
  //         : []),
  //     ],
  //   }
  // })
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

    const ranked = await rankedUser(user.minecraftUUID)
    if (!ranked)
      return status(404, 'User has no recorded personal best.')

    return ranked.statistics.total.bestTime.ranked
  })
