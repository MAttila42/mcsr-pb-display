import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

import { db } from '../db'
import { Users } from '../db/schema'
import { getRankedUser } from '../services/ranked'
import { setSession } from '../services/session'
import { createRankedInfoFromUser, upsertUser } from '../services/user'
import { twitchValidate } from '../utils'
import linkPage from './link.html' with { type: 'text' }

export const link = new Elysia({
  strictPath: false,
  adapter: CloudflareAdapter,
})
  .get('/link', () => new Response(linkPage.toString(), {
    headers: { 'Content-Type': 'text/html' },
  }))
  .post('/link/ranked', async ({ body, headers, request, status }: any) => {
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

    const mcUsername = typeof body?.mcUsername === 'string'
      ? body.mcUsername.trim()
      : ''
    if (!mcUsername)
      return status(400, 'Missing Minecraft username.')

    let ranked
    try {
      ranked = await getRankedUser(mcUsername, request.signal, twLogin)
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
        message: 'Could not verify your Ranked account via Twitch link. Continue with Microsoft login.',
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
  .post('/unlink/:account', async ({ params, headers, request, status }: any) => {
    const account = params.account?.toLowerCase()
    if (account !== 'ranked')
      return status(400, 'Unsupported account type.')

    const authHeader = headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return status(401, 'Missing or invalid Authorization header.')

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token)
      return status(401, 'Missing or invalid Authorization header.')

    let twitch: { login?: string }
    try {
      twitch = await twitchValidate(token, request.signal)
    }
    catch {
      return status(401, 'Invalid Twitch token.')
    }

    const twitchLogin = typeof twitch.login === 'string'
      ? twitch.login.toLowerCase()
      : undefined
    if (!twitchLogin)
      return status(500, 'Unexpected Twitch response.')

    await db
      .update(Users)
      .set({
        mcUUID: null,
        mcUsername: null,
      })
      .where(eq(Users.twLogin, twitchLogin))

    return status(204)
  })
  .post('/session', ({ headers, cookie, status }: any) => {
    const authHeader = headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return status(401, 'Missing or invalid Authorization header.')

    const token = authHeader.split(' ')[1]
    const sessionId = randomBytes(32).toString('hex')

    setSession(sessionId, {
      token,
      ttl: Date.now() + (15 * 60 * 1000),
    })
    cookie.session_id.set({
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 15 * 60,
    })

    return status(201)
  })
