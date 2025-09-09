import type { Env } from 'bun'
import type { Context } from 'elysia'
import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { records } from './routes/records'

const app = new Elysia({
  strictPath: false,
  aot: false,
})
  .use(cors())
  .use(records)

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
