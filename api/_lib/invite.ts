import { randomBytes } from 'node:crypto'

/**
 * Help-person invitation tokens.
 *
 * Format: `j1_<issued-at ms, base36>_<48 random hex>`. The issue time travels inside the token, so
 * replacement invitations get a fresh expiry without a new database column. It cannot be forged:
 * the API only accepts a token that matches the stored `help_join_token` exactly, and the random
 * part carries the secret.
 *
 * Tokens from before this format (48 hex, or the seeded demo token) were only ever issued when the
 * patient was created, so `patients.created_at` is their issue time.
 */
export const JOIN_TTL_MS = 72 * 3600_000
/** Allowed clock skew for a token that claims to be issued in the future */
const SKEW_MS = 5 * 60_000

export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,128}$/

export const newJoinToken = (now = Date.now()) => `j1_${now.toString(36)}_${randomBytes(24).toString('hex')}`

/** When the invitation was issued, in ms, or null if unknown */
export function issuedAt(token: string, createdAt: string | null | undefined): number | null {
  const m = /^j1_([0-9a-z]{1,11})_[0-9a-f]{48}$/.exec(token)
  if (m) return parseInt(m[1], 36)
  const created = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(created) ? created : null
}

export function isExpired(token: string, createdAt: string | null | undefined, now = Date.now()): boolean {
  const at = issuedAt(token, createdAt)
  if (at === null || at > now + SKEW_MS) return true
  return now - at >= JOIN_TTL_MS
}
