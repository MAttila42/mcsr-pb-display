interface VersionParts {
  major: number
  minor: number
  bugfix: number
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

function parseVersion(version: string): VersionParts | null {
  const match = VERSION_PATTERN.exec(version.trim())
  if (!match)
    return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    bugfix: Number(match[3]),
  }
}

export function isVersionAtLeast(version: string, minimum: string): boolean {
  const currentParts = parseVersion(version)
  const minimumParts = parseVersion(minimum)

  if (!currentParts || !minimumParts)
    return false

  if (currentParts.major !== minimumParts.major)
    return currentParts.major > minimumParts.major

  if (currentParts.minor !== minimumParts.minor)
    return currentParts.minor > minimumParts.minor

  return currentParts.bugfix >= minimumParts.bugfix
}
