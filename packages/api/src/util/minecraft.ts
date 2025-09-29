import process from 'node:process'
import { createThrottledQueue } from './throttle'

const MC = (process.env.MC_API_OVERRIDE ?? '').trim()
  || 'https://api.minecraftservices.com'

const LOGIN = `${MC}/authentication/login_with_xbox`
const ENTITLEMENTS = `${MC}/entitlements/license`
const PROFILE = `${MC}/minecraft/profile`
const PROFILE_LOOKUP = `${MC}/minecraft/profile/lookup`

const REQUESTS_PER_WINDOW = 600
const WINDOW_MS = 10 * 60 * 1000
const INTERVAL_MS = Math.ceil(WINDOW_MS / REQUESTS_PER_WINDOW)

const runMinecraftRequest = createThrottledQueue(INTERVAL_MS)

async function throttledFetch(...args: Parameters<typeof fetch>) {
  return runMinecraftRequest(() => fetch(...args))
}

export async function minecraftLogin(xstsToken: string, uhs?: string) {
  const body = { identityToken: `XBL3.0 x=${uhs};${xstsToken}` }
  const res = await throttledFetch(LOGIN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok)
    throw new Error('MC login failed')
  return res.json()
}

export async function minecraftEntitlements(mcAccess: string) {
  const res = await throttledFetch(ENTITLEMENTS, { headers: { Authorization: `Bearer ${mcAccess}` } })
  if (!res.ok)
    throw new Error('MC entitlements failed')
  return res.json()
}

export async function minecraftProfile(mcAccess: string) {
  const res = await throttledFetch(PROFILE, { headers: { Authorization: `Bearer ${mcAccess}` } })
  if (!res.ok)
    throw new Error('MC profile failed')
  return res.json()
}

export async function minecraftProfileLookup(uuid: string) {
  const res = await throttledFetch(`${PROFILE_LOOKUP}/${uuid}`)
  if (!res.ok)
    throw new Error('MC profile lookup failed')
  return res.json()
}
