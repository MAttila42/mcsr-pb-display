const XBL_AUTH = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_AUTH = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_LOGIN = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MC_ENTITLEMENTS = 'https://api.minecraftservices.com/entitlements/license'
const MC_PROFILE = 'https://api.minecraftservices.com/minecraft/profile'

export async function xblAuthenticate(msAccess: string) {
  const body = {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccess}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  }
  const res = await fetch(XBL_AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok)
    throw new Error('XBL auth failed')
  return res.json()
}

export async function xstsAuthorize(xblToken: string) {
  const body = {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  }
  const res = await fetch(XSTS_AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok)
    throw new Error('XSTS auth failed')
  return res.json()
}

export async function minecraftLogin(xstsToken: string, uhs?: string) {
  const body = { identityToken: `XBL3.0 x=${uhs};${xstsToken}` }
  const res = await fetch(MC_LOGIN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok)
    throw new Error('MC login failed')
  return res.json()
}

export async function minecraftEntitlements(mcAccess: string) {
  const url = `${MC_ENTITLEMENTS}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${mcAccess}` } })
  if (!res.ok)
    throw new Error('MC entitlements failed')
  return res.json()
}

export async function minecraftProfile(mcAccess: string) {
  const res = await fetch(MC_PROFILE, { headers: { Authorization: `Bearer ${mcAccess}` } })
  if (!res.ok)
    throw new Error('MC profile failed')
  return res.json()
}
