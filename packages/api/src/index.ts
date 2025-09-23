import type { Env } from 'bun'
import type { Context } from 'elysia'
import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { cors } from '@elysiajs/cors'
import { createHandler } from '@rttnd/gau/core'
import { Elysia } from 'elysia'
import { auth } from './auth'
import link from './link.html' with { type: 'text' }
import { setSession } from './store/session'
import { user } from './user'

const handler = createHandler(auth)

const app = new Elysia({
  strictPath: false,
  aot: false,
})
  .mount(handler)
  .use(cors())
  .use(user)
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
