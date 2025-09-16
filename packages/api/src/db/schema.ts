import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const Users = sqliteTable('users', {
  twitchLogin: text().primaryKey(),
  minecraftUUID: text().notNull(),
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type SelectUser = typeof Users.$inferSelect
export type InsertUser = typeof Users.$inferInsert
