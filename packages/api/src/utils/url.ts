export function normalizeBase(url: string) {
  return url.replace(/\/+$/, '')
}

export function ensureTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}
