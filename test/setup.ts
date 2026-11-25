/**
 * Runs before every test file (vite.config.ts > test.setupFiles).
 *
 *  - Refuses to run unless every service key is the dummy value from test/env.ts.
 *  - Blocks real network access (test/networkGuard.ts).
 *  - Replaces the Supabase client with the in-memory fake (test/mocks/supabase.ts).
 *  - After each test: real timers, empty fake database, cleared rate limits, original environment.
 *    Mocks, stubbed globals and stubbed env vars are restored by the config (restoreMocks, unstubGlobals, unstubEnvs).
 */
/// <reference types="vite/client" />
import { afterEach, beforeEach, vi } from 'vitest'
import { TEST_ENV } from './env.js'
import { installNetworkGuard } from './networkGuard.js'
import { testDb } from './mocks/supabase.js'
import { resetAllLimiters } from '../api/_lib/rateLimit.js'

vi.mock('@supabase/supabase-js', async () => {
  const { testDb } = await import('./mocks/supabase.js')
  return { createClient: () => testDb.client }
})

// Fail closed: never run with a real key, even if .env is present on this machine
for (const [key, value] of Object.entries(TEST_ENV)) {
  if (process.env[key] !== value) throw new Error(`Test setup: ${key} is not the dummy test value. Refusing to run.`)
}
if (import.meta.env.VITE_API_URL !== TEST_ENV.VITE_API_URL) throw new Error('Test setup: VITE_API_URL is not the dummy test value. Refusing to run.')

const ENV_SNAPSHOT = { ...process.env }

installNetworkGuard()

beforeEach(() => {
  installNetworkGuard()
})

afterEach(() => {
  vi.useRealTimers()
  testDb.reset()
  resetAllLimiters()
  // Undo direct process.env edits (vi.stubEnv is undone by the config)
  for (const key of Object.keys(process.env)) if (!(key in ENV_SNAPSHOT)) delete process.env[key]
  Object.assign(process.env, ENV_SNAPSHOT)
})
