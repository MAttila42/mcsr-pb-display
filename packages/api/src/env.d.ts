interface CloudflareQueueBinding {
  send: <Body = unknown>(body: Body, options?: {
    contentType?: 'text' | 'bytes' | 'json' | 'v8'
    delaySeconds?: number
  }) => Promise<void>
}

interface CloudflareKVNamespace {
  get: {
    (key: string): Promise<string | null>
    (key: string, type: 'text'): Promise<string | null>
    (key: string, type: 'json'): Promise<unknown | null>
    (key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
    (key: string, type: 'stream'): Promise<ReadableStream | null>
  }
  put: (
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      expiration?: number
      expirationTtl?: number
      metadata?: unknown
    },
  ) => Promise<void>
  delete: (key: string) => Promise<void>
}

interface CloudflareQueueMessage<Body = unknown> {
  id: string
  body: Body
  attempts: number
  ack: () => void
  retry: (options?: { delaySeconds?: number }) => void
}

interface CloudflareQueueBatch<Body = unknown> {
  queue: string
  messages: ReadonlyArray<CloudflareQueueMessage<Body>>
  ackAll: () => void
  retryAll: (options?: { delaySeconds?: number }) => void
}

interface CloudflareEnv {
  NODE_ENV: string
  DB: D1Database
  UPDATE_QUEUE: CloudflareQueueBinding
  PB_CACHE: CloudflareKVNamespace
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
