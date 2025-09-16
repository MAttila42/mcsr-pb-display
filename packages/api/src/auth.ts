import process from 'node:process'
import { MemoryAdapter } from '@rttnd/gau/adapters/memory'
import { createAuth } from '@rttnd/gau/core'
import { Microsoft } from '@rttnd/gau/oauth'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { Users } from './db/schema'
import { getSession } from './store/session'
import { twitchValidate } from './util/twitch'
import {
  minecraftEntitlements,
  minecraftLogin,
  minecraftProfile,
  xblAuthenticate,
  xstsAuthorize,
} from './util/xbox'

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

    const sessionId = ctx.cookies.get('session_id')
    if (!sessionId) {
      return {
        handled: true,
        response: new Response(
          'Missing session cookie.',
          { status: 400 },
        ),
      }
    }

    const sessionData = getSession(sessionId)
    if (!sessionData) {
      return {
        handled: true,
        response: new Response(
          'Session expired or invalid.',
          { status: 400 },
        ),
      }
    }

    const minecraft = await minecraftProfile(mc.access_token)
    const twitch = await twitchValidate(sessionData.token)

    const [existing] = await db
      .select()
      .from(Users)
      .where(eq(Users.twitchLogin, twitch.login))
    if (existing) {
      await db
        .update(Users)
        .set({ minecraftUUID: minecraft.id })
        .where(eq(Users.twitchLogin, twitch.login))
    }
    else {
      await db.insert(Users).values({
        twitchLogin: twitch.login,
        minecraftUUID: minecraft.id,
      })
    }

    return {
      handled: true,
      response: new Response(
        `Authentication done! You can close this tab now.</br>
        Twitch: ${twitch.login}</br>
        Minecraft: ${minecraft.name}`,
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      ),
    }
  },
})

export type Auth = typeof auth
