/* eslint-disable no-console */
import process from 'node:process'
import { $ } from 'bun'

const DB_FILE = './sqlite.db'

const dbFile = Bun.file(DB_FILE)
const dbExists = await dbFile.exists()

if (!dbExists) {
  console.log('Database file not found, creating and migrating...')
  try {
    await $`bun drizzle-kit push`
    console.log('Database created and migrated successfully.')
  }
  catch (error) {
    console.error('Error creating or migrating the database:', error)
    process.exit(1)
  }
}
else {
  console.log('Database file already exists.')
}
