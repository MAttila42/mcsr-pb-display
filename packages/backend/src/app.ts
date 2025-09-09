import { Elysia } from 'elysia'
import { records } from './routes/records'

export const app = new Elysia({ strictPath: false, aot: false })
  .use(records)
