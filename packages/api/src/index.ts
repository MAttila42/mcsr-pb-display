import { app } from './app'
import { setDb } from './db'
import { setPbCache } from './services/cache'
import { consumePbRefreshQueue, setUpdateQueue } from './services/queue'

export type { App } from './app'

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    setDb(env.DB)
    setUpdateQueue(env.UPDATE_QUEUE)
    setPbCache(env.PB_CACHE)
    return await app.fetch(request)
  },

  async queue(batch: CloudflareQueueBatch, env: CloudflareEnv): Promise<void> {
    setDb(env.DB)
    setPbCache(env.PB_CACHE)
    await consumePbRefreshQueue(batch)
  },
}
