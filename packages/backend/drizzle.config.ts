import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: isDev
      ? process.env.DATABASE_URL_LOCAL!
      : process.env.DATABASE_URL_REMOTE!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
})
