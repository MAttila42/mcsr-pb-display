import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const Users = sqliteTable('users', {
  twLogin: text('tw_login').primaryKey(),
  mcUUID: text('mc_uuid'),
  mcUsername: text('mc_username'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, table => ([
  uniqueIndex('twitchLoginIdx').on(table.twLogin),
]))

export type SelectUser = typeof Users.$inferSelect
export type InsertUser = typeof Users.$inferInsert
