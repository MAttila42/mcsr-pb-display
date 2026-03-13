interface RankedThrottleRequest {
  identifier?: string
}

interface RankedThrottleRpc {
  acquire: (request?: RankedThrottleRequest) => Promise<void>
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
  export interface DurableObjectState {}

  export abstract class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState
    protected readonly env: Env

    constructor(ctx: DurableObjectState, env: Env)
  }
}
