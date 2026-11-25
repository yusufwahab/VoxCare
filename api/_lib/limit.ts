import type { VercelRequest } from '@vercel/node'
import { HttpError } from './env.js'

const hits = new Map<string, { n: number; reset: number }>()

/** Tiny per-IP limiter for guessable inputs (the 6-digit visit code). One server instance, so memory is enough. */
export function limit(req: VercelRequest, bucket: string, max: number, windowMs = 60_000) {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs })
  else if (++h.n > max) throw new HttpError(429, 'Too many tries. Wait a minute.')
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
}
