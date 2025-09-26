import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const Users = sqliteTable('users', {
  twLogin: text('tw_login').primaryKey(),
  mcUUID: text('mc_uuid').notNull(),
  mcUsername: text('mc_username').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type SelectUser = typeof Users.$inferSelect
export type InsertUser = typeof Users.$inferInsert
