const TW_VALIDATE = 'https://id.twitch.tv/oauth2/validate'
const TW_VALIDATE_TIMEOUT_MS = 5000

function createTimeoutSignal(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort('timeout')
  }, timeoutMs)
  const abort = () => controller.abort()

  if (signal?.aborted)
    controller.abort()
  else
    signal?.addEventListener('abort', abort, { once: true })

  return {
    signal: controller.signal,
    timedOut() {
      return timedOut
    },
    cleanup() {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abort)
    },
  }
}

export async function twitchValidate(twAccess: string, signal?: AbortSignal) {
  const request = createTimeoutSignal(TW_VALIDATE_TIMEOUT_MS, signal)

  try {
    const res = await fetch(TW_VALIDATE, {
      headers: {
        Authorization: `OAuth ${twAccess}`,
      },
      signal: request.signal,
    })
    if (!res.ok)
      throw new Error('Twitch validate failed')

    return await res.json()
  }
  catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && request.timedOut())
      throw new Error('Twitch validate timed out')

    throw err
  }
  finally {
    request.cleanup()
  }
}
