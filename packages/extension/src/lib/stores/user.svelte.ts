import type { UserResponse } from '@api/types/user'

export const user = $state<UserResponse>({
  twLogin: '',
  rankedInfo: null,
})
