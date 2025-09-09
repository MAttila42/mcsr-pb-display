import { asc } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../db/index'
import { test } from '../db/schema'

export const records = new Elysia({ prefix: '/records' })
  .get('/', async () => {
    const rows = await db.select().from(test).orderBy(asc(test.id))
    return rows
  })
  .post('/', async ({ body }) => {
    const [inserted] = await db
      .insert(test)
      .values({ text: body.text })
      .returning()

    return inserted
  }, {
    body: t.Object({
      text: t.String({ minLength: 1 }),
    }),
  })
  .delete('/purge', async () => {
    await db.delete(test)
    return { success: true }
  })
