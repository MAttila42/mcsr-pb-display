const LOGIN = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const ENTITLEMENTS = 'https://api.minecraftservices.com/entitlements/license'
const PROFILE = 'https://api.minecraftservices.com/minecraft/profile'
const PROFILE_LOOKUP = 'https://api.minecraftservices.com/minecraft/profile/lookup'
const RANKED_USER = 'https://mcsrranked.com/api/users'

export async function minecraftLogin(xstsToken: string, uhs?: string) {
  const body = { identityToken: `XBL3.0 x=${uhs};${xstsToken}` }
  const res = await fetch(LOGIN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok)
    throw new Error('MC login failed')
  return res.json()
}

export async function minecraftEntitlements(mcAccess: string) {
  const res = await fetch(ENTITLEMENTS, { headers: { Authorization: `Bearer ${mcAccess}` } })
  if (!res.ok)
    throw new Error('MC entitlements failed')
  return res.json()
}

export async function minecraftProfile(mcAccess: string) {
  const res = await fetch(PROFILE, { headers: { Authorization: `Bearer ${mcAccess}` } })
  if (!res.ok)
    throw new Error('MC profile failed')
  return res.json()
}

export async function minecraftProfileLookup(uuid: string) {
  const res = await fetch(`${PROFILE_LOOKUP}/${uuid}`)
  if (!res.ok)
    throw new Error('MC profile lookup failed')
  return res.json()
}

export async function rankedUser(uuid: string) {
  const res = await fetch(`${RANKED_USER}/${uuid}`)
  if (!res.ok)
    throw new Error('Ranked user fetch failed')
  const json = await res.json()
  if (json.status === 'error')
    return null
  return json.data
}
