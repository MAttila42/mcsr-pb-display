import type { Env } from 'bun'
import type { Context } from 'elysia'

import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { cors } from '@elysiajs/cors'
import { createHandler } from '@rttnd/gau/core'
import { eq } from 'drizzle-orm'
import { Elysia, file } from 'elysia'

import { auth } from './auth'
import { db } from './db'
import { Users } from './db/schema'
import link from './link.html' with { type: 'text' }
import { clearCache } from './store/cache'
import { setSession } from './store/session'
import { user } from './user'
import { twitchValidate } from './util'

const handler = createHandler(auth)

const app = new Elysia({
  strictPath: false,
  aot: false,
})
  .mount(handler)
  .use(cors())
  .use(user)
  .get(
    '/.well-known/microsoft-identity-association.json',
    file('./public/.well-known/microsoft-identity-association.json'),
  )
  .get('/link', () => new Response(link.toString(), {
    headers: { 'Content-Type': 'text/html' },
  }))
  .post('/session', ({ headers, cookie, status }) => {
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
  .post('/unlink/:account', async ({ params, headers, status }) => {
    const account = params.account?.toLowerCase()
    if (account !== 'ranked')
      return status(400, 'Unsupported account type.')

    const authHeader = headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return status(401, 'Missing or invalid Authorization header.')

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token)
      return status(401, 'Missing or invalid Authorization header.')

    let twitch: any
    try {
      twitch = await twitchValidate(token)
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

    clearCache(`pb:${twitchLogin}`)

    return status(204)
  })
  .get('/', 'This is the backend API for the MCSR PB Display extension. No content here.')

export type App = typeof app

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: Context,
  ): Promise<Response> {
    return await app.fetch(request)
  },
}
