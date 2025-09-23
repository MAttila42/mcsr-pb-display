const RANKED_USER = 'https://mcsrranked.com/api/users'

export async function rankedUser(uuid: string) {
  const res = await fetch(`${RANKED_USER}/${uuid}`)
  if (!res.ok)
    throw new Error('Ranked user fetch failed')
  const json = await res.json()
  if (json.status === 'error')
    return null
  return json.data
}
