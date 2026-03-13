import type { UserResponse } from '@api/types/user'
import browser from 'webextension-polyfill'

const CACHED_USER_KEY = 'cachedUser'

export type UserFetchStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface UserState {
  twLogin: string
  rankedInfo: UserResponse['rankedInfo']
}

const EMPTY_USER: UserState = {
  twLogin: '',
  rankedInfo: null,
}

const state = $state<{
  user: UserState
  fetchStatus: UserFetchStatus
}>({
  user: { ...EMPTY_USER },
  fetchStatus: 'idle',
})

function applyUser(data: UserState) {
  state.user.twLogin = data.twLogin
  state.user.rankedInfo = data.rankedInfo
}

export const userStore = {
  get user() {
    return state.user
  },

  get fetchStatus() {
    return state.fetchStatus
  },

  setFetchStatus(status: UserFetchStatus) {
    state.fetchStatus = status
  },

  resetRuntime() {
    applyUser(EMPTY_USER)
    state.fetchStatus = 'idle'
  },

  async hydrate(login?: string): Promise<UserResponse | null> {
    if (!login) {
      this.resetRuntime()
      return null
    }

    const raw = await browser.storage.local.get(CACHED_USER_KEY)
    const cached = raw[CACHED_USER_KEY] as UserResponse | undefined

    if (cached && cached.twLogin === login) {
      applyUser(cached)
      return cached
    }

    applyUser(EMPTY_USER)
    return null
  },

  async setUser(data: UserResponse): Promise<void> {
    applyUser(data)
    await browser.storage.local.set({ [CACHED_USER_KEY]: data })
  },

  async setUnlinked(twLogin: string): Promise<void> {
    const data: UserResponse = {
      twLogin,
      rankedInfo: null,
    }

    applyUser(data)
    await browser.storage.local.set({ [CACHED_USER_KEY]: data })
  },
}

export const user = userStore.user
