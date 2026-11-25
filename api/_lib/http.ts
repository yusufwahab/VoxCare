import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENERIC_ERROR, HttpError, safeMessage } from './env.js'

type Handler = (req: VercelRequest) => Promise<unknown>

/** Wrap a handler: JSON in, JSON out, errors become { error } with a status code. */
export function route(handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const out = await handler(req)
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(out ?? {})
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      // Log the path only: query strings carry join links, device tokens and patient ids.
      // Unexpected errors log only their type: their messages can echo request data.
      if (status >= 500) console.error('[api]', (req.url ?? '').split('?')[0], safeMessage(e))
      if (e instanceof HttpError && e.headers) for (const [name, value] of Object.entries(e.headers)) res.setHeader(name, value)
      res.status(status).json({ error: e instanceof HttpError && e.expose ? e.message : GENERIC_ERROR })
    }
  }
}

export const body = <T>(req: VercelRequest): T => {
  if (typeof req.body !== 'string') return (req.body ?? {}) as T
  try { return JSON.parse(req.body) as T } catch { throw new HttpError(400, 'Invalid request') }
}

/** https://<domain> of this deployment, for links inside emails */
export const baseUrl = (req: VercelRequest): string => {
  // The frontend (Vercel) is a different host from this API (Render), so links in emails use FRONTEND_URL
  const front = process.env.FRONTEND_URL?.split(',')[0]?.trim().replace(/\/$/, '')
  if (front) return front
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost:3000')
  const proto = String(req.headers['x-forwarded-proto'] ?? (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0]
  return `${proto}://${host}`
}

export const q =(req: VercelRequest, key: string): string => {
  const v = req.query[key]
  return String(Array.isArray(v) ? v[0] : (v ?? ''))
}
