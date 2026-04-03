const XBL_AUTH = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_AUTH = 'https://xsts.auth.xboxlive.com/xsts/authorize'

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
