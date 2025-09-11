import { DrizzleAdapter } from '@rttnd/gau/adapters/drizzle'
import { createAuth } from '@rttnd/gau/core'
import { Microsoft } from '@rttnd/gau/oauth'
import { db } from './db'
import { Accounts, Users } from './db/schema'

export const auth = createAuth({
  adapter: DrizzleAdapter(db, Users, Accounts),
  basePath: '/auth',
  providers: [
    Microsoft({
      clientId: import.meta.env.MICROSOFT_CLIENT_ID!,
      clientSecret: import.meta.env.MICROSOFT_CLIENT_SECRET!,
    }),
  ],
  jwt: {
    secret: import.meta.env.AUTH_SECRET!,
  },
  cors: false,
  trustHosts: 'all',
})

export type Auth = typeof auth
