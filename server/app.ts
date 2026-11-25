/**
 * The Render request handler: serves the same handlers that live in /api, over plain Node http.
 * The frontend is hosted on Vercel and calls this server from the browser (CORS).
 * Kept apart from server/index.ts (which only listens) so tests can import it.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isProduction } from '../api/_lib/env.js'

// The handlers are typed for Vercel's request and response; this server passes compatible objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: any, res: any) => Promise<void>

// Whitelist: only these files are reachable
const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
  alert: () => import('../api/alert.js'),
  briefing: () => import('../api/briefing.js'),
  'doctor-login': () => import('../api/doctor-login.js'),
  emergency: () => import('../api/emergency.js'),
  facts: () => import('../api/facts.js'),
  join: () => import('../api/join.js'),
  patient: () => import('../api/patient.js'),
  'test-email': () => import('../api/test-email.js'),
  verify: () => import('../api/verify.js'),
}
/** Never served on the live deployment */
const DEV_ONLY = new Set(['test-email'])

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/

/** Production: only the FRONTEND_URL origins. Development: those plus http://localhost and 127.0.0.1. */
export function isAllowedOrigin(origin: string): boolean {
  const approved = (process.env.FRONTEND_URL ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
  if (approved.includes(origin)) return true
  return !isProduction() && LOCALHOST.test(origin)
}

/** Sets CORS headers for an approved origin. Returns false when the request has an origin that is not approved. */
function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  if (!isAllowedOrigin(origin)) return false
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400')
  return true
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(data))
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const originOk = cors(req, res)
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'OPTIONS') {
    res.statusCode = originOk ? 204 : 403
    return void res.end()
  }
  if (url.pathname === '/health' || url.pathname === '/') return send(res, 200, { ok: true, service: 'voxcare-api' })

  const m = url.pathname.match(/^\/api\/([\w-]+)$/)
  const name = m?.[1] ?? ''
  const load = Object.hasOwn(ROUTES, name) && !(DEV_ONLY.has(name) && isProduction()) ? ROUTES[name] : undefined
  if (!load) return send(res, 404, { error: 'Not found' })

  try {
    // Photos arrive as data URLs, so allow a body of about 3 MB
    let raw = ''
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > 3_000_000) return send(res, 413, { error: 'Too large' })
    }
    let parsed: unknown = {}
    try { parsed = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { error: 'Invalid request' }) }
    const fake = Object.assign(req, { query: Object.fromEntries(url.searchParams), body: parsed })
    const out = Object.assign(res, {
      status(code: number) {
        res.statusCode = code
        return out
      },
      json(data: unknown) {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(data))
      },
    })
    const mod = await load()
    await mod.default(fake, out)
  } catch (e) {
    // Log the path and error type only: messages can echo request data
    console.error('[server]', url.pathname, e instanceof Error ? e.name : typeof e)
    if (!res.headersSent) send(res, 500, { error: 'Server error' })
  }
}
