import { MemoryAdapter } from '@rttnd/gau/adapters/memory'
import { createAuth } from '@rttnd/gau/core'
import { GitHub } from '@rttnd/gau/oauth'

export const auth = createAuth({
  adapter: MemoryAdapter(),
  basePath: '/auth',
  providers: [
    GitHub({
      clientId: import.meta.env.AUTH_GITHUB_ID!,
      clientSecret: import.meta.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  jwt: {
    secret: import.meta.env.AUTH_SECRET!,
  },
  trustHosts: 'all',
})

export type Auth = typeof auth
