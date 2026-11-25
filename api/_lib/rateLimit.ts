/**
 * In-memory sliding-window rate limiter.
 *
 * Limits of keeping counts in memory:
 *  - A restart or redeploy clears every count.
 *  - Each server instance counts on its own, so N instances allow N times the limit.
 *    The README tells you to run a single Render instance; scaling out needs a shared store (database or Redis).
 *  - At most `maxKeys` clients are tracked; past that the oldest key is forgotten to bound memory.
 */

export interface Limiter {
  /** Record one attempt for `key`. Refused when the key already used its whole budget in the window. */
  take(key: string): { ok: true } | { ok: false; retryAfterMs: number }
  /** Give back the most recent attempt (for example after a success, or a failure that was not the client's fault). */
  release(key: string): void
  /** Forget everything about `key`. */
  clear(key: string): void
  /** Forget everything. */
  reset(): void
}

import { HttpError } from './env.js'

const all = new Set<Limiter>()

export function createLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): Limiter {
  const { limit, windowMs, maxKeys = 10_000 } = opts
  const hits = new Map<string, number[]>()

  const recent = (key: string, now: number) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (list.length) hits.set(key, list)
    else hits.delete(key)
    return list
  }

  const limiter: Limiter = {
    take(key) {
      const now = Date.now()
      const list = recent(key, now)
      if (list.length >= limit) return { ok: false, retryAfterMs: Math.max(1, windowMs - (now - list[0])) }
      if (!hits.has(key) && hits.size >= maxKeys) {
        const oldest = hits.keys().next().value
        if (oldest !== undefined) hits.delete(oldest)
      }
      list.push(now)
      hits.set(key, list)
      return { ok: true }
    },
    release(key) {
      const list = hits.get(key)
      if (!list?.length) return
      list.pop()
      if (!list.length) hits.delete(key)
    },
    clear(key) {
      hits.delete(key)
    },
    reset() {
      hits.clear()
    },
  }
  all.add(limiter)
  return limiter
}

/** Clears every limiter in this process. Used between tests. */
export function resetAllLimiters(): void {
  for (const l of all) l.reset()
}

/**
 * Take one attempt from `limiter` for `key`, or throw 429 with Retry-After (seconds).
 * Synchronous, so it must run before the handler's first await: parallel requests then cannot all pass.
 * `label` and `source` are logged; the key (an IP address) is not.
 */
export function enforce(limiter: Limiter, key: string, label: string, source?: string): void {
  const r = limiter.take(key)
  if (r.ok) return
  console.warn('[rate-limit]', label, { source })
  throw new HttpError(429, 'Too many requests. Wait a few minutes and try again.', { 'Retry-After': String(Math.ceil(r.retryAfterMs / 1000)) })
}
