import { eq, sql } from 'drizzle-orm'

import { db } from '../db'
import { Users } from '../db/schema'
import { setCachedPb } from './cache'
import { getRankedUser } from './ranked'

interface UserLinkRow {
  twLogin: string
  mcUUID: string | null
  mcUsername: string | null
}

export interface PbRefreshResult {
  twLogin: string
  pb: number | null
  fetchedAt: string
}

function normalizeTwitchLogin(twLogin: string) {
  return twLogin.toLowerCase().trim()
}

function hasLinkedAccount(user: UserLinkRow | undefined) {
  return Boolean(user?.mcUUID && user.mcUsername)
}

async function findUserLinkByTwitchLogin(twLogin: string): Promise<UserLinkRow | undefined> {
  const [user] = await db
    .select({
      twLogin: Users.twLogin,
      mcUUID: Users.mcUUID,
      mcUsername: Users.mcUsername,
    })
    .from(Users)
    .where(eq(Users.twLogin, twLogin))

  if (user)
    return user

  const [caseInsensitiveUser] = await db
    .select({
      twLogin: Users.twLogin,
      mcUUID: Users.mcUUID,
      mcUsername: Users.mcUsername,
    })
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

async function upsertUserLink(twLogin: string, mcUUID: string, mcUsername: string) {
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

export async function refreshPbForTwitchLogin(twLogin: string, signal?: AbortSignal): Promise<PbRefreshResult> {
  const normalizedTwLogin = normalizeTwitchLogin(twLogin)
  if (!normalizedTwLogin)
    throw new Error('Missing Twitch login in PB refresh request')

  const linkedUser = await findUserLinkByTwitchLogin(normalizedTwLogin)

  let ranked = null

  if (linkedUser?.mcUsername)
    ranked = await getRankedUser(linkedUser.mcUsername, signal, normalizedTwLogin)

  const hasTriedTwitchName = linkedUser?.mcUsername?.toLowerCase() === normalizedTwLogin
  if (!ranked && !hasTriedTwitchName)
    ranked = await getRankedUser(normalizedTwLogin, signal, normalizedTwLogin)

  const pb = ranked?.statistics?.total?.bestTime?.ranked ?? null

  if (ranked) {
    const shouldUpsertLink = !hasLinkedAccount(linkedUser)
      || linkedUser?.mcUUID !== ranked.uuid
      || linkedUser?.mcUsername !== ranked.nickname

    if (shouldUpsertLink)
      await upsertUserLink(normalizedTwLogin, ranked.uuid, ranked.nickname)
  }

  if (!ranked)
    await setCachedPb(normalizedTwLogin, null)

  return {
    twLogin: normalizedTwLogin,
    pb,
    fetchedAt: new Date().toISOString(),
  }
}
