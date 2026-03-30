import process from 'node:process'
import { cors } from '@elysiajs/cors'
import { createHandler } from '@rttnd/gau/core'
import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

import { auth } from './auth'
import { db } from './db'
import { Users } from './db/schema'
import { link } from './plugins/link'
import { user } from './plugins/user'

const handler = createHandler(auth)
const MICROSOFT_IDENTITY_ASSOCIATION = JSON.stringify({
  associatedApplications: [
    {
      applicationId: process.env.MICROSOFT_CLIENT_ID,
    },
  ],
})

export const app = new Elysia({
  strictPath: false,
  adapter: CloudflareAdapter,
})
  .mount(handler)
  .use(cors())
  .use(user)
  .use(link)
  .get('/.well-known/microsoft-identity-association.json', () => new Response(MICROSOFT_IDENTITY_ASSOCIATION, {
    headers: { 'Content-Type': 'application/json' },
  }))
  .get('/', () => 'This is the backend API for the MCSR PB Display extension. No content here.')
  .get('/test', async () => await db.select().from(Users).all())
  .compile()

export type App = typeof app
