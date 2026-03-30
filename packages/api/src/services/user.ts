import type { UserResponse } from '../types/user'
import type { RankedUser } from './ranked'
import { eq, sql } from 'drizzle-orm'

import { db } from '../db'
import { Users } from '../db/schema'
import { getCachedPb } from './cache'
import {
  createPbRefreshPayload,
  enqueuePriorityUpdateAndWait,
  enqueueUpdate,
} from './queue'

const MAX_PBS_USERS = 200

export const MAX_AGE = 3600

export function createRankedInfo(ranked: RankedUser | null): NonNullable<UserResponse['rankedInfo']> | null {
  if (!ranked)
    return null

  return {
    mcUUID: ranked.uuid,
    mcUsername: ranked.nickname,
    pb: ranked.statistics?.total?.bestTime?.ranked ?? null,
    elo: ranked.eloRate ?? null,
  }
}

export function createRankedInfoFromUser(ranked: RankedUser): NonNullable<UserResponse['rankedInfo']> {
  return {
    mcUUID: ranked.uuid,
    mcUsername: ranked.nickname,
    pb: ranked.statistics?.total?.bestTime?.ranked ?? null,
    elo: ranked.eloRate ?? null,
  }
}

export function createDbRankedInfo(mcUUID: string, mcUsername: string): NonNullable<UserResponse['rankedInfo']> {
  return {
    mcUUID,
    mcUsername,
    pb: null,
    elo: null,
  }
}

export async function upsertUser(twLogin: string, mcUUID: string, mcUsername: string) {
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

export async function findUserByTwitchLogin(twLogin: string) {
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

export function parsePbsUsersQuery(usersQuery: unknown): string[] {
  if (typeof usersQuery !== 'string')
    return []

  const users = usersQuery
    .split(',')
    .map(tw => tw.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_PBS_USERS)

  return [...new Set(users)]
}

function isPbRefreshQueueResult(value: unknown): value is { pb: number | null } {
  if (!value || typeof value !== 'object')
    return false

  const record = value as Record<string, unknown>
  return record.type === 'pb-refresh' && (record.pb === null || typeof record.pb === 'number')
}

async function refreshPbInBackground(twLogin: string) {
  try {
    await enqueueUpdate(createPbRefreshPayload(twLogin))
  }
  catch (error) {
    console.error('Failed to enqueue background PB refresh', { twLogin, error })
  }
}

async function fetchPbWithPriorityQueue(twLogin: string, signal?: AbortSignal): Promise<number | null> {
  const queueResult = await enqueuePriorityUpdateAndWait(createPbRefreshPayload(twLogin), { signal })
  if (queueResult.status === 'failed')
    throw new Error(queueResult.error ?? 'Priority PB refresh failed')

  if (isPbRefreshQueueResult(queueResult.result))
    return queueResult.result.pb

  const cached = await getCachedPb(twLogin)
  if (cached.status === 'miss')
    return null

  return cached.pb
}

export async function fetchBulkPbs(twList: string[], signal?: AbortSignal): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = Object.create(null)

  for (const tw of twList) {
    try {
      const cached = await getCachedPb(tw)

      if (cached.status === 'fresh') {
        results[tw] = cached.pb
        continue
      }

      if (cached.status === 'stale') {
        results[tw] = cached.pb
        void refreshPbInBackground(tw)
        continue
      }

      results[tw] = await fetchPbWithPriorityQueue(tw, signal)
    }
    catch {
      results[tw] = null
    }
  }

  return results
}
