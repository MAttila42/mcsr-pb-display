import { db } from '../db'
import { Users } from '../db/schema'
import { getCachedLink, setCachedLink, setCachedPb } from './cache'
import { getRankedUser } from './ranked'
import { findUserLinkByTwitchLogin } from './user'

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

  let ranked = await getRankedUser(normalizedTwLogin, signal, normalizedTwLogin)

  let linkedUser: UserLinkRow | undefined

  if (!ranked) {
    const cachedLink = await getCachedLink(normalizedTwLogin)
    if (cachedLink) {
      ranked = await getRankedUser(cachedLink.mcUsername, signal, normalizedTwLogin)
      if (ranked)
        linkedUser = { twLogin: normalizedTwLogin, mcUUID: cachedLink.mcUUID, mcUsername: cachedLink.mcUsername }
    }
  }

  if (!ranked) {
    linkedUser = await findUserLinkByTwitchLogin(normalizedTwLogin)
    if (linkedUser?.mcUsername)
      ranked = await getRankedUser(linkedUser.mcUsername, signal, normalizedTwLogin)
  }

  const pb = ranked?.statistics?.total?.bestTime?.ranked ?? null

  if (ranked) {
    const sameUsername = normalizedTwLogin === ranked.nickname.toLowerCase()
    const shouldUpsertLink = !sameUsername && (!hasLinkedAccount(linkedUser)
      || linkedUser?.mcUUID !== ranked.uuid
      || linkedUser?.mcUsername !== ranked.nickname)

    if (shouldUpsertLink)
      await upsertUserLink(normalizedTwLogin, ranked.uuid, ranked.nickname)

    await setCachedLink(normalizedTwLogin, ranked.uuid, ranked.nickname)
  }

  if (!ranked)
    await setCachedPb(normalizedTwLogin, null)

  return {
    twLogin: normalizedTwLogin,
    pb,
    fetchedAt: new Date().toISOString(),
  }
}
