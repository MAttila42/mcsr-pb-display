export interface RankedInfo {
  mcUUID: string
  mcUsername: string
  pb: number | null
  elo: number | null
}

export interface UserResponse {
  twLogin: string
  rankedInfo: RankedInfo | null
}
