import type { Auth } from '@api/auth'
import { useAuth as useAuthCore } from '@rttnd/gau/client/svelte'

export const useAuth = () => useAuthCore<Auth>()
