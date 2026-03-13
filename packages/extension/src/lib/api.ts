import type { App } from '@api'
import { treaty } from '@elysiajs/eden'

const API_URL = import.meta.env.VITE_API_URL

export const api = treaty<App>(API_URL)
