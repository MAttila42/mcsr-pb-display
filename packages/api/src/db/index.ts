import type { AnyD1Database } from 'drizzle-orm/d1'
import { drizzle } from 'drizzle-orm/d1'

export type Db = ReturnType<typeof drizzle>

let runtimeDb: Db | undefined

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    if (!runtimeDb)
      throw new Error('Database not initialized. Did you forget to call setDb?')

    const value = Reflect.get(runtimeDb, prop)
    if (typeof value === 'function')
      return value.bind(runtimeDb)

    return value
  },
}) as Db

export function setDb(d1: AnyD1Database) {
  runtimeDb = drizzle(d1)
}
