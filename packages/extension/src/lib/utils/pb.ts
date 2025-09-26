export function formatTime(ms: number): string {
  const date = new Date(ms)
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')
  const formatted = hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
  return formatted
}
