const TW_VALIDATE = 'https://id.twitch.tv/oauth2/validate'
const TW_VALIDATE_TIMEOUT_MS = 5000

export async function twitchValidate(twAccess: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TW_VALIDATE_TIMEOUT_MS)

  try {
    const res = await fetch(TW_VALIDATE, {
      headers: {
        Authorization: `OAuth ${twAccess}`,
      },
      signal: controller.signal,
    })
    if (!res.ok)
      throw new Error('Twitch validate failed')

    return await res.json()
  }
  catch (err) {
    if (err instanceof Error && err.name === 'AbortError')
      throw new Error('Twitch validate timed out')

    throw err
  }
  finally {
    clearTimeout(timeoutId)
  }
}
