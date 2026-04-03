import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  casing: 'snake_case',
  ...(isProduction
    ? {
        driver: 'd1-http',
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
          databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
          token: process.env.CLOUDFLARE_D1_TOKEN!,
        },
      }
    : {
        dbCredentials: {
          url: process.env.DATABASE_URL_LOCAL || 'local.db',
        },
      }),
  strict: true,
  verbose: false,
})
