import { waitUntil } from 'cloudflare:workers'
import { and, asc, desc, eq } from 'drizzle-orm'

import { db } from '../db'
import { UpdateQueueItems } from '../db/schema'
import { setCachedPb } from './cache'
import { getRankedUser } from './ranked'

const CONSUME_INTERVAL_MS = 500
const PRIORITY_WAIT_TIMEOUT_MS = 60_000
const PRIORITY_WAIT_POLL_MS = 100
const WAKE_SIGNAL_RETRY_MS = 2_000

type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type JsonValue
  = | null
    | boolean
    | number
    | string
    | JsonValue[]
    | { [key: string]: JsonValue }

export interface QueueConsumeResult {
  itemId: number
  status: Extract<QueueStatus, 'completed' | 'failed'>
  result: JsonValue | null
  error: string | null
}

export interface PbRefreshQueuePayload extends Record<string, JsonValue> {
  type: 'pb-refresh'
  twLogin: string
}

export interface PbRefreshQueueResult extends Record<string, JsonValue> {
  type: 'pb-refresh'
  twLogin: string
  pb: number | null
  fetchedAt: string
}

type QueuePayload = PbRefreshQueuePayload

interface QueueRowSnapshot {
  id: number
  status: QueueStatus
  resultJson: string | null
  error: string | null
}

interface EnqueueOptions {
  signal?: AbortSignal
}

interface EnqueuePriorityOptions extends EnqueueOptions {
  timeoutMs?: number
}

interface ConsumeOptions {
  maxItems?: number
}

let runtimeQueue: CloudflareQueueBinding | undefined

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function ensureQueueBinding() {
  if (!runtimeQueue)
    throw new Error('Queue binding not initialized. Did you forget to call setUpdateQueue?')

  return runtimeQueue
}

function serializeJson(value: JsonValue) {
  return JSON.stringify(value)
}

function deserializeJson(value: string | null): JsonValue | null {
  if (!value)
    return null

  return JSON.parse(value) as JsonValue
}

function serializeError(error: unknown) {
  if (error instanceof Error)
    return error.message

  return 'Unknown queue processing error'
}

function scheduleWakeSignal() {
  const wakePromise = sendWakeSignal().catch((error) => {
    console.error('Failed to send queue wake signal', error)
  })

  try {
    waitUntil(wakePromise)
  }
  catch {
    void wakePromise
  }
}

async function sendWakeSignal() {
  const queue = ensureQueueBinding()
  await queue.send({ type: 'wake' }, { delaySeconds: 0 })
}

function normalizeTwitchLogin(twLogin: string) {
  return twLogin.toLowerCase().trim()
}

function isPbRefreshQueuePayload(payload: JsonValue): payload is PbRefreshQueuePayload {
  if (!payload || typeof payload !== 'object')
    return false

  const record = payload as Record<string, unknown>
  return record.type === 'pb-refresh' && typeof record.twLogin === 'string'
}

async function insertQueueItem(payload: QueuePayload, priority: boolean) {
  const [created] = await db
    .insert(UpdateQueueItems)
    .values({
      priority,
      status: 'pending',
      payloadJson: serializeJson(payload),
      resultJson: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    })
    .returning({ id: UpdateQueueItems.id })

  if (!created)
    throw new Error('Failed to enqueue item')

  return created.id
}

async function getQueueRow(id: number): Promise<QueueRowSnapshot | undefined> {
  const [row] = await db
    .select({
      id: UpdateQueueItems.id,
      status: UpdateQueueItems.status,
      resultJson: UpdateQueueItems.resultJson,
      error: UpdateQueueItems.error,
    })
    .from(UpdateQueueItems)
    .where(eq(UpdateQueueItems.id, id))

  return row
}

async function claimNextPendingItem() {
  while (true) {
    const [next] = await db
      .select({ id: UpdateQueueItems.id })
      .from(UpdateQueueItems)
      .where(eq(UpdateQueueItems.status, 'pending'))
      .orderBy(desc(UpdateQueueItems.priority), asc(UpdateQueueItems.createdAt), asc(UpdateQueueItems.id))
      .limit(1)

    if (!next)
      return undefined

    const [claimed] = await db
      .update(UpdateQueueItems)
      .set({
        status: 'processing',
        startedAt: new Date(),
        finishedAt: null,
        error: null,
      })
      .where(and(
        eq(UpdateQueueItems.id, next.id),
        eq(UpdateQueueItems.status, 'pending'),
      ))
      .returning({
        id: UpdateQueueItems.id,
        payloadJson: UpdateQueueItems.payloadJson,
      })

    if (claimed)
      return claimed
  }
}

async function processQueuePayload(payload: JsonValue): Promise<PbRefreshQueueResult> {
  if (!isPbRefreshQueuePayload(payload))
    throw new Error('Unsupported queue payload')

  const twLogin = normalizeTwitchLogin(payload.twLogin)
  if (!twLogin)
    throw new Error('Missing Twitch login in queue payload')

  const ranked = await getRankedUser(twLogin)
  const pb = ranked?.statistics?.total?.bestTime?.ranked ?? null

  if (!ranked)
    await setCachedPb(twLogin, null)

  return {
    type: 'pb-refresh',
    twLogin,
    pb,
    fetchedAt: new Date().toISOString(),
  }
}

async function markCompleted(itemId: number, result: JsonValue) {
  await db
    .update(UpdateQueueItems)
    .set({
      status: 'completed',
      resultJson: serializeJson(result),
      error: null,
      finishedAt: new Date(),
    })
    .where(eq(UpdateQueueItems.id, itemId))
}

async function markFailed(itemId: number, error: unknown) {
  await db
    .update(UpdateQueueItems)
    .set({
      status: 'failed',
      error: serializeError(error),
      finishedAt: new Date(),
    })
    .where(eq(UpdateQueueItems.id, itemId))
}

async function consumeNext() {
  const claimed = await claimNextPendingItem()
  if (!claimed)
    return false

  await sleep(CONSUME_INTERVAL_MS)

  try {
    const payload = deserializeJson(claimed.payloadJson)
    const result = await processQueuePayload(payload)
    await markCompleted(claimed.id, result)
  }
  catch (error) {
    await markFailed(claimed.id, error)
  }

  return true
}

async function waitForCompletion(itemId: number, timeoutMs: number, signal?: AbortSignal): Promise<QueueConsumeResult> {
  const startedAt = Date.now()
  let nextWakeSignalAt = startedAt + WAKE_SIGNAL_RETRY_MS

  while (true) {
    if (signal?.aborted)
      throw new Error('Priority queue wait aborted')

    if ((Date.now() - startedAt) > timeoutMs)
      throw new Error('Priority queue wait timed out')

    const row = await getQueueRow(itemId)
    if (!row)
      throw new Error('Priority queue item not found')

    if (row.status === 'completed') {
      return {
        itemId,
        status: 'completed',
        result: deserializeJson(row.resultJson),
        error: null,
      }
    }

    if (row.status === 'failed') {
      return {
        itemId,
        status: 'failed',
        result: null,
        error: row.error ?? 'Queue processing failed',
      }
    }

    if (Date.now() >= nextWakeSignalAt) {
      scheduleWakeSignal()
      nextWakeSignalAt = Date.now() + WAKE_SIGNAL_RETRY_MS
    }

    await sleep(PRIORITY_WAIT_POLL_MS)
  }
}

export function setUpdateQueue(queue: CloudflareQueueBinding) {
  runtimeQueue = queue
}

export function createPbRefreshPayload(twLogin: string): PbRefreshQueuePayload {
  const normalized = normalizeTwitchLogin(twLogin)
  if (!normalized)
    throw new Error('Cannot enqueue PB refresh for empty Twitch login')

  return {
    type: 'pb-refresh',
    twLogin: normalized,
  }
}

export async function enqueueUpdate(payload: QueuePayload, _options: EnqueueOptions = {}) {
  const itemId = await insertQueueItem(payload, false)
  scheduleWakeSignal()

  return { itemId }
}

export async function enqueuePriorityUpdateAndWait(payload: QueuePayload, options: EnqueuePriorityOptions = {}): Promise<QueueConsumeResult> {
  const itemId = await insertQueueItem(payload, true)
  scheduleWakeSignal()

  return waitForCompletion(
    itemId,
    options.timeoutMs ?? PRIORITY_WAIT_TIMEOUT_MS,
    options.signal,
  )
}

export async function consumeUpdateQueueItems({ maxItems = 1 }: ConsumeOptions = {}) {
  if (maxItems < 1)
    return 0

  let consumed = 0

  while (consumed < maxItems) {
    const didConsume = await consumeNext()
    if (!didConsume)
      break

    consumed += 1
  }

  return consumed
}
