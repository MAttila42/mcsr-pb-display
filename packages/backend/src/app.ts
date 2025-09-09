import { Elysia } from 'elysia'
import { records } from './routes/records'

export const app = new Elysia()
  .get('/', () => 'Hello Elysia')
  .use(records)
