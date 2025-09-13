import { int, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const test = sqliteTable('test', {
  id: int().primaryKey({ autoIncrement: true }),
  text: text().notNull(),
})

export const Users = sqliteTable('users', {
  twitchLogin: text().primaryKey(),
  minecraftUUID: text().notNull(),
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type SelectUser = typeof Users.$inferSelect
export type InsertUser = typeof Users.$inferInsert
