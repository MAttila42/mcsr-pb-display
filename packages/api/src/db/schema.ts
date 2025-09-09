import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const test = sqliteTable('test', {
  id: int().primaryKey({ autoIncrement: true }),
  text: text().notNull(),
})
