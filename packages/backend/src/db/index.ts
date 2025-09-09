import process from 'node:process'
import { drizzle } from 'drizzle-orm/libsql'

const isDev = process.env.NODE_ENV === 'development'

export const db = drizzle({
  connection: {
    url: isDev
      ? process.env.DATABASE_URL_LOCAL!
      : process.env.DATABASE_URL_REMOTE!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  },
})
