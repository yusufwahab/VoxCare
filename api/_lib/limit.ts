import type { VercelRequest } from '@vercel/node'
import { clientKey } from './clientIp.js'
import { createLimiter, enforce, type Limiter } from './rateLimit.js'

const buckets = new Map<string, Limiter>()

/**
 * Per-client limiter for guessable inputs (the 6-digit visit code). Uses the same client identification as the
 * other limits (X-Forwarded-For only from Render's private proxy), so a client cannot reset it with a fake header.
 * In memory: one server instance.
 */
export function limit(req: VercelRequest, bucket: string, max: number, windowMs = 60_000) {
  let l = buckets.get(bucket)
  if (!l) buckets.set(bucket, (l = createLimiter({ limit: max, windowMs })))
  const c = clientKey(req)
  enforce(l, c.key, bucket, c.source)
}
