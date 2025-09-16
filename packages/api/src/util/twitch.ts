const TW_VALIDATE = 'https://id.twitch.tv/oauth2/validate'

export async function twitchValidate(twAccess: string) {
  const res = await fetch(TW_VALIDATE, { headers: {
    Authorization: `OAuth ${twAccess}`,
  } })
  if (!res.ok)
    throw new Error('Twitch validate failed')
  return res.json()
}
