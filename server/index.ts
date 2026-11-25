/**
 * Render entry point. Serves the same handlers that live in /api, over plain Node http.
 * The frontend is hosted on Vercel and calls this server from the browser (CORS).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

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
  visit: () => import('../api/visit.js'),
  'visit-events': () => import('../api/visit-events.js'),
}

const allowed = (process.env.FRONTEND_URL ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin
  if (origin && (allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
}

const server = createServer(async (req, res) => {
  cors(req, res)
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return void res.end()
  }
  if (url.pathname === '/health' || url.pathname === '/') {
    res.setHeader('content-type', 'application/json')
    return void res.end(JSON.stringify({ ok: true, service: 'voxcare-api' }))
  }

  const m = url.pathname.match(/^\/api\/([\w-]+)$/)
  const load = m && ROUTES[m[1]]
  if (!load) {
    res.statusCode = 404
    res.setHeader('content-type', 'application/json')
    return void res.end(JSON.stringify({ error: 'Not found' }))
  }

  try {
    // Photos arrive as data URLs, so allow a body of about 3 MB
    let raw = ''
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > 3_000_000) {
        res.statusCode = 413
        res.setHeader('content-type', 'application/json')
        return void res.end(JSON.stringify({ error: 'Too large' }))
      }
    }
    const fake = Object.assign(req, { query: Object.fromEntries(url.searchParams), body: raw ? JSON.parse(raw) : {} })
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
    console.error('[server]', url.pathname, e instanceof Error ? e.message : e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Server error' }))
    }
  }
})

const port = Number(process.env.PORT ?? 3000)
server.listen(port, '0.0.0.0', () => console.log(`voxcare-api listening on ${port}`))
