import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError } from './env.js'

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
      const message = e instanceof Error ? e.message : 'Server error'
      if (status >= 500) console.error('[api]', req.url, message)
      res.status(status).json({ error: message })
    }
  }
}

export const body = <T>(req: VercelRequest): T => (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})) as T

/** https://<domain> of this deployment, for links inside emails */
export const baseUrl = (req: VercelRequest): string => {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost:3000')
  const proto = String(req.headers['x-forwarded-proto'] ?? (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0]
  return `${proto}://${host}`
}

export const q =(req: VercelRequest, key: string): string => {
  const v = req.query[key]
  return String(Array.isArray(v) ? v[0] : (v ?? ''))
}
