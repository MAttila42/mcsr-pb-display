type Task<T> = () => Promise<T> | T

interface ThrottleOptions {
  /**
   * Minimum delay in milliseconds between the start time of two tasks.
   *
   * Defaults to `intervalMs` when omitted.
   */
  minDelayMs?: number
}

/**
 * Creates a throttled queue that serializes asynchronous tasks, ensuring at least `intervalMs` time between task starts. Useful for rate-limited APIs.
 */
export function createThrottledQueue(intervalMs: number, { minDelayMs = intervalMs }: ThrottleOptions = {}) {
  if (intervalMs < 0)
    throw new Error('intervalMs must be non-negative')

  let lastRun = 0
  let chain: Promise<unknown> = Promise.resolve()

  const runNext = <T>(task: Task<T>): Promise<T> => {
    const execute = async () => {
      const now = Date.now()
      const delay = Math.max(minDelayMs - (now - lastRun), 0)
      if (delay > 0)
        await new Promise<void>(resolve => setTimeout(resolve, delay))

      try {
        const result = await task()
        return result
      }
      finally {
        lastRun = Date.now()
      }
    }

    const next = chain.then(execute, execute)
    chain = next.catch(() => { /* keep chain alive */ })
    return next
  }

  return runNext
}
