import { refreshPbForTwitchLogin } from './refresh'

export interface PbRefreshQueuePayload {
  type: 'pb-refresh'
  twLogin: string
}

let runtimeQueue: CloudflareQueueBinding | undefined

function ensureQueueBinding() {
  if (!runtimeQueue)
    throw new Error('Queue binding not initialized. Did you forget to call setUpdateQueue?')

  return runtimeQueue
}

function normalizeTwitchLogin(twLogin: string) {
  return twLogin.toLowerCase().trim()
}

function isPbRefreshQueuePayload(payload: unknown): payload is PbRefreshQueuePayload {
  if (!payload || typeof payload !== 'object')
    return false

  const record = payload as Record<string, unknown>
  return record.type === 'pb-refresh' && typeof record.twLogin === 'string'
}

function createPbRefreshPayload(twLogin: string): PbRefreshQueuePayload {
  const normalized = normalizeTwitchLogin(twLogin)
  if (!normalized)
    throw new Error('Cannot enqueue PB refresh for empty Twitch login')

  return {
    type: 'pb-refresh',
    twLogin: normalized,
  }
}

export function setUpdateQueue(queue: CloudflareQueueBinding) {
  runtimeQueue = queue
}

export async function enqueuePbRefresh(twLogin: string) {
  const queue = ensureQueueBinding()
  await queue.send(createPbRefreshPayload(twLogin))
}

export async function consumePbRefreshQueue(batch: CloudflareQueueBatch<unknown>) {
  for (const message of batch.messages) {
    if (!isPbRefreshQueuePayload(message.body)) {
      console.error('Dropping unsupported queue payload', {
        messageId: message.id,
      })
      message.ack()
      continue
    }

    try {
      await refreshPbForTwitchLogin(message.body.twLogin)
      message.ack()
    }
    catch (error) {
      console.error('Failed to process PB refresh queue message', {
        messageId: message.id,
        twLogin: message.body.twLogin,
        attempts: message.attempts,
        error,
      })
      message.retry()
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
