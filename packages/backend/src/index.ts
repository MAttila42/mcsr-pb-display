import type { Env } from 'bun'
import type { Context } from 'elysia'
import { app } from './app'

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: Context,

  ): Promise<Response> {
    return await app.fetch(request)
  },
}
