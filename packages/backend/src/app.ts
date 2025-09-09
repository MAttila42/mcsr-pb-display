import { Elysia } from 'elysia'
import { records } from './routes/records'

export const app = new Elysia({ aot: false })
  .onError(({ code, error }) => {
    console.error(code)
    return new Response(JSON.stringify({ error: error.toString() ?? code }), { status: 500 })
  })
  .get('/', () => 'Hello Elysia')
  .use(records)
