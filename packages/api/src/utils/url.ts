const REGEXP_TRAILING_SLASH = /\/+$/

export function normalizeBase(url: string) {
  return url.replace(REGEXP_TRAILING_SLASH, '')
}

export function ensureTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}
