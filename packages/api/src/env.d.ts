interface RankedThrottleRequest {
  identifier?: string
}

interface RankedCacheSnapshot {
  twLogin: string
  mcUUID: string
  mcUsername: string
  pb: number | null
  elo: number | null
  fetchedAt: number
}

interface RankedThrottleRpc {
  acquire: (request?: RankedThrottleRequest) => Promise<void>
  getCachedSnapshot: (twLogin: string) => Promise<RankedCacheSnapshot | null>
  getCachedSnapshots: (twLogins: string[]) => Promise<Record<string, RankedCacheSnapshot>>
  setCachedSnapshot: (snapshot: RankedCacheSnapshot) => Promise<void>
  deleteCachedSnapshot: (twLogin: string) => Promise<void>
}

interface DurableObjectNamespace<T = unknown> {
  getByName: (name: string) => T
}

interface CloudflareEnv {
  NODE_ENV: string
  DATABASE_URL_LOCAL: string
  DATABASE_URL_REMOTE: string
  DATABASE_AUTH_TOKEN: string
  AUTH_SECRET: string
  MICROSOFT_CLIENT_ID: string
  MICROSOFT_CLIENT_SECRET: string
  RANKED_THROTTLE: DurableObjectNamespace<RankedThrottleRpc>
}

declare module 'bun' {
  interface Env {
    NODE_ENV: string
    DATABASE_URL_LOCAL: string
    DATABASE_URL_REMOTE: string
    DATABASE_AUTH_TOKEN: string
    AUTH_SECRET: string
    MICROSOFT_CLIENT_ID: string
    MICROSOFT_CLIENT_SECRET: string
  }
}

declare module 'cloudflare:workers' {
  export interface DurableObjectStorage {
    get: <T>(key: string) => Promise<T | undefined>
    put: <T>(key: string, value: T) => Promise<void>
    delete: (key: string) => Promise<boolean>
  }

  export interface DurableObjectState<Props = unknown> {
    storage: DurableObjectStorage
  }

  export abstract class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState
    protected readonly env: Env

    constructor(ctx: DurableObjectState, env: Env)
  }

  export function waitUntil(promise: Promise<unknown>): void
}
