import type { Env } from 'bun'
import type { Context } from 'elysia'
import { Elysia } from 'elysia'
import { records } from './routes/records'

const app = new Elysia()
  .get('/', () => 'Hello Elysia')
  .use(records)
  .listen(3000)

// eslint-disable-next-line no-console
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: Context,

  ): Promise<Response> {
    return await app.fetch(request)
  },
}
