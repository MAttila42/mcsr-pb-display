import { app } from './app'
import { setDb } from './db'

export type { App } from './app'

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    setDb(env.DB)
    return await app.fetch(request)
  },
}
