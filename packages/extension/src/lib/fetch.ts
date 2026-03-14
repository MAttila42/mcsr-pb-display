export const API_TIMEOUT_MS = 30000

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const externalSignal = init.signal

  const abort = () => controller.abort()

  if (externalSignal?.aborted)
    controller.abort()
  else
    externalSignal?.addEventListener('abort', abort, { once: true })

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  }
  finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abort)
  }
}
