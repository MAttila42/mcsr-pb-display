import process from 'node:process'
import { MemoryAdapter } from '@rttnd/gau/adapters/memory'
import { createAuth } from '@rttnd/gau/core'
import { Microsoft } from '@rttnd/gau/oauth'
import {
  minecraftEntitlements,
  minecraftLogin,
  xblAuthenticate,
  xstsAuthorize,
} from './xbox'

export const auth = createAuth({
  adapter: MemoryAdapter(),
  basePath: '/auth',
  providers: [
    Microsoft({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    }),
  ],
  profiles: {
    microsoft: {
      xbox: {
        tenant: 'consumers',
        scopes: ['XboxLive.signin', 'openid'],
        prompt: 'select_account',
      },
    },
  },
  jwt: {
    secret: process.env.AUTH_SECRET!,
  },
  cors: false,
  trustHosts: 'all',
  onOAuthExchange: async (ctx) => {
    const msAccess = ctx.tokens.accessToken()
    const xbl = await xblAuthenticate(msAccess)
    const xsts = await xstsAuthorize(xbl.Token)
    const mc = await minecraftLogin(xsts.Token, xsts.DisplayClaims?.xui?.[0]?.uhs)

    const ent = await minecraftEntitlements(mc.access_token)
    const owned: any[] = Array.isArray(ent.items) ? ent.items : []
    const hasJava = owned.some(o => o.name === 'product_minecraft' || o.name === 'game_minecraft')
    if (!hasJava) {
      return {
        handled: true,
        response: new Response(
          `This account does not own Minecraft! Please try again with a different account. ${JSON.stringify(owned)}`,
          { status: 403 },
        ),
      }
    }

    return {
      handled: true,
      response: new Response(
        `<script>window.onload = window.close</script>
        Authentication done! You can close this tab now.`,
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      ),
    }
  },
})

export type Auth = typeof auth
