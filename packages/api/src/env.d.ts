interface CloudflareEnv {
  NODE_ENV: string
  DB: D1Database
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_DATABASE_ID: string
  CLOUDFLARE_D1_TOKEN: string
  AUTH_SECRET: string
  MICROSOFT_CLIENT_ID: string
  MICROSOFT_CLIENT_SECRET: string
}

declare module 'bun' {
  interface Env {
    NODE_ENV: string
    DATABASE_URL_LOCAL: string
    CLOUDFLARE_ACCOUNT_ID: string
    CLOUDFLARE_DATABASE_ID: string
    CLOUDFLARE_D1_TOKEN: string
    AUTH_SECRET: string
    MICROSOFT_CLIENT_ID: string
    MICROSOFT_CLIENT_SECRET: string
  }
}

declare module 'cloudflare:workers' {
  export function waitUntil(promise: Promise<unknown>): void
}
