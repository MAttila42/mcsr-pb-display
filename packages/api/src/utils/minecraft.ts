import process from 'node:process'
import { createThrottledQueue } from './throttle'
import { ensureTrailingSlash, normalizeBase } from './url'

const DEFAULT_MC_API = 'https://api.minecraftservices.com'

const LOGIN_PATH = 'authentication/login_with_xbox'
const ENTITLEMENTS_PATH = 'entitlements/license'
const PROFILE_PATH = 'minecraft/profile'
const PROFILE_LOOKUP_PATH = 'minecraft/profile/lookup'

const REQUESTS_PER_WINDOW = 600
const WINDOW_MS = 10 * 60 * 1000
const INTERVAL_MS = Math.ceil(WINDOW_MS / REQUESTS_PER_WINDOW)

const rawApiOverride = (process.env.MC_API_OVERRIDE ?? '').trim()
const proxyToken = (process.env.PROXY_TOKEN ?? '').trim()

const useProxy = proxyToken.length > 0
const proxyEndpoint = useProxy ? normalizeBase(rawApiOverride || '') : ''
const targetBase = normalizeBase(
  useProxy ? DEFAULT_MC_API : (rawApiOverride || DEFAULT_MC_API),
)

const runMinecraftRequest = createThrottledQueue(INTERVAL_MS)

async function throttledFetch(...args: Parameters<typeof fetch>) {
  return runMinecraftRequest(() => fetch(...args))
}

function buildTargetUrl(path: string) {
  if (/^https?:\/\//i.test(path))
    return path
  const baseWithSlash = ensureTrailingSlash(targetBase || DEFAULT_MC_API)
  return new URL(path, baseWithSlash).toString()
}

function headersToObject(headers?: HeadersInit) {
  if (!headers)
    return undefined
  const record: Record<string, string> = {}
  const normalized = new Headers(headers)
  normalized.forEach((value, key) => {
    record[key] = value
  })
  return Object.keys(record).length > 0 ? record : undefined
}

function serializeProxyBody(body: RequestInit['body']) {
  if (body == null)
    return undefined
  if (typeof body === 'string')
    return body
  if (body instanceof URLSearchParams)
    return body.toString()
  throw new Error('Proxy requests currently require a string or URLSearchParams body.')
}

function ensureProxyUrl() {
  if (!proxyEndpoint)
    throw new Error('PROXY_TOKEN is set but MC_API_OVERRIDE is missing. Provide the proxy base via MC_API_OVERRIDE.')
  return ensureTrailingSlash(proxyEndpoint)
}

async function minecraftFetch(path: string, init: RequestInit = {}) {
  const targetUrl = buildTargetUrl(path)
  if (!useProxy)
    return throttledFetch(targetUrl, init)

  const proxyUrl = ensureProxyUrl()
  const { headers, body, method } = init
  const proxyPayload: Record<string, unknown> = {
    url: targetUrl,
  }

  const serializedHeaders = headersToObject(headers)
  if (serializedHeaders)
    proxyPayload.headers = serializedHeaders

  proxyPayload.method = method ?? 'GET'

  const serializedBody = serializeProxyBody(body)
  if (serializedBody !== undefined)
    proxyPayload.body = serializedBody

  return throttledFetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${proxyToken}`,
    },
    body: JSON.stringify(proxyPayload),
  })
}

export async function minecraftLogin(xstsToken: string, uhs?: string) {
  const body = { identityToken: `XBL3.0 x=${uhs};${xstsToken}` }
  const res = await minecraftFetch(LOGIN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok)
    throw new Error('MC login failed')
  return res.json()
}

export async function minecraftEntitlements(mcAccess: string) {
  const res = await minecraftFetch(ENTITLEMENTS_PATH, {
    headers: { Authorization: `Bearer ${mcAccess}` },
  })
  if (!res.ok)
    throw new Error('MC entitlements failed')
  return res.json()
}

export async function minecraftProfile(mcAccess: string) {
  const res = await minecraftFetch(PROFILE_PATH, {
    headers: { Authorization: `Bearer ${mcAccess}` },
  })
  if (!res.ok)
    throw new Error('MC profile failed')
  return res.json()
}

export async function minecraftProfileLookup(uuid: string) {
  const res = await minecraftFetch(`${PROFILE_LOOKUP_PATH}/${uuid}`)
  if (!res.ok)
    throw new Error('MC profile lookup failed')
  return res.json()
}
