import type { Env } from 'bun'
import type { Context } from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { createHandler } from '@rttnd/gau/core'
import { Elysia } from 'elysia'
import { auth } from './auth'
import { records } from './routes/records'

const handler = createHandler(auth)

const app = new Elysia({
  strictPath: false,
  aot: false,
})
  .mount(handler)
  .use(cors())
  .use(staticPlugin({ prefix: '/' }))
  .use(records)
  .get('/auth-success', 'Account link was successful! You can close this tab.')
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
