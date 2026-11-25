import type { VercelRequest } from '@vercel/node'
import { route, body } from './_lib/http.js'
import { HttpError, isProduction } from './_lib/env.js'
import { db, sha256, signDoctor } from './_lib/supabase.js'
import { createLimiter } from './_lib/rateLimit.js'
import { clientKey } from './_lib/clientIp.js'

/** PINs published in the README and seed data. Never accepted on the live deployment. */
const PUBLIC_DEMO_PINS = new Set(['1234'])

export const LOGIN_WINDOW_MS = 15 * 60_000
/** Attempts one client may make in the window. A successful login clears that client's count. */
export const PER_CLIENT_LIMIT = 5
/**
 * Unsuccessful attempts from all clients together in the window. Slows a guessing attack spread over
 * many addresses. Trade-off: someone with many addresses can use it up and block every doctor's login
 * until the window passes. Removing that trade-off needs per-doctor lockout (see README, "Doctor sign-in").
 */
export const GLOBAL_LIMIT = 50

const perClient = createLimiter({ limit: PER_CLIENT_LIMIT, windowMs: LOGIN_WINDOW_MS })
const everyone = createLimiter({ limit: GLOBAL_LIMIT, windowMs: LOGIN_WINDOW_MS })
const EVERYONE = 'all'

const tooMany = (retryAfterMs: number) =>
  new HttpError(429, 'Too many attempts. Wait a few minutes and try again.', { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) })

/** The PIN, or a 400. Never echoes what was sent. */
function readPin(req: VercelRequest): string {
  let b: unknown
  try {
    b = body<unknown>(req)
  } catch {
    throw new HttpError(400, 'Invalid request')
  }
  const pin = b && typeof b === 'object' && !Array.isArray(b) ? (b as { pin?: unknown }).pin : undefined
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) throw new HttpError(400, 'Invalid request')
  return pin
}

/** POST { pin } -> { doctor, token } if a verified doctor has this PIN, otherwise { doctor: null }. */
export default route(async (req) => {
  const pin = readPin(req)
  const { key, source } = clientKey(req)

  // Count the attempt before the database call, so parallel requests cannot all get through
  const mine = perClient.take(key)
  if (!mine.ok) {
    console.warn('[doctor-login] rate limited', { scope: 'client', source })
    throw tooMany(mine.retryAfterMs)
  }
  const all = everyone.take(EVERYONE)
  if (!all.ok) {
    perClient.release(key)
    console.warn('[doctor-login] rate limited', { scope: 'global', source })
    throw tooMany(all.retryAfterMs)
  }

  if (isProduction() && PUBLIC_DEMO_PINS.has(pin)) {
    console.warn('[doctor-login] public demo PIN refused in production')
    return { doctor: null }
  }

  const { data, error } = await db()
    .from('doctors')
    .select('id,name,mdcn_number,verified')
    .eq('verified', true)
    .eq('pin', sha256(`voxcare:${pin}`))
    .limit(2)
  if (error) {
    // Not the doctor's fault: give the attempt back. Log only the error code, never the query.
    perClient.release(key)
    everyone.release(EVERYONE)
    console.error('[doctor-login] database error', { code: error.code ?? 'unknown' })
    throw new HttpError(503, 'Sign-in is not available right now. Try again soon.')
  }
  if (!data || data.length !== 1) {
    // Two verified doctors sharing a PIN would make the login ambiguous, so refuse it like a wrong PIN
    if (data && data.length > 1) console.warn('[doctor-login] two verified doctors share a PIN; login refused')
    return { doctor: null }
  }

  perClient.clear(key)
  everyone.release(EVERYONE)
  return { doctor: data[0], token: signDoctor(data[0].id) }
})
