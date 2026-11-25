import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { handle, isAllowedOrigin } from './app.js'
import { json, mockFetch } from '../test/mocks/fetch.js'

const FRONT = 'https://app.test.invalid' // FRONTEND_URL in test/env.ts
// The guarded fetch (loopback allowed), saved before a test stubs globalThis.fetch
const realFetch = globalThis.fetch

let server: Server
let base = ''
beforeAll(async () => {
  server = createServer((req, res) => void handle(req, res))
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((ok) => server.close(() => ok())))

const preflight = (origin: string) => fetch(`${base}/api/join`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } })
const production = () => vi.stubEnv('NODE_ENV', 'production')

describe('CORS', () => {
  it('allows the Vercel frontend in production and development', async () => {
    for (const env of ['production', 'development']) {
      vi.stubEnv('NODE_ENV', env)
      const r = await preflight(FRONT)
      expect(r.status).toBe(204)
      expect(r.headers.get('access-control-allow-origin')).toBe(FRONT)
      expect(r.headers.get('access-control-allow-headers')).toContain('authorization')
    }
  })

  it('allows several approved origins from FRONTEND_URL', () => {
    production()
    vi.stubEnv('FRONTEND_URL', `${FRONT}, https://voxcare.example.test/`)
    expect(isAllowedOrigin('https://voxcare.example.test')).toBe(true)
    expect(isAllowedOrigin(FRONT)).toBe(true)
  })

  it('allows localhost only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect((await preflight('http://localhost:5173')).headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true)

    production()
    const r = await preflight('http://localhost:5173')
    expect(r.status).toBe(403)
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(isAllowedOrigin('http://localhost:5173')).toBe(false)
  })

  it.each([
    'https://evil.example',
    'https://app.test.invalid.evil.example',
    'http://app.test.invalid',
    'http://localhost.evil.example',
    'null',
  ])('refuses %s', async (origin) => {
    vi.stubEnv('NODE_ENV', 'development')
    const r = await preflight(origin)
    expect(r.status).toBe(403)
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
    // A real request gets no CORS header, so the browser will not hand the reply to that page
    const g = await fetch(`${base}/health`, { headers: { origin } })
    expect(g.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('requests without an Origin (curl, health checks) still work', async () => {
    production()
    const r = await fetch(`${base}/health`)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, service: 'voxcare-api' })
  })
})

describe('routing and errors', () => {
  it('the test-email endpoint does not exist in production and sends nothing', async () => {
    const brevo = vi.fn(() => json({}, 201))
    mockFetch([[/^http:\/\/127\.0\.0\.1/, (u, i) => realFetch(u, i)], ['https://api.brevo.com/', brevo]])
    production()
    const r = await fetch(`${base}/api/test-email`, { method: 'POST', headers: { origin: FRONT } })
    expect(r.status).toBe(404)
    expect(brevo).not.toHaveBeenCalled()
  })

  it('the test-email endpoint works in development and does not return the address', async () => {
    const brevo = vi.fn(() => json({}, 201))
    mockFetch([[/^http:\/\/127\.0\.0\.1/, (u, i) => realFetch(u, i)], ['https://api.brevo.com/', brevo]])
    vi.stubEnv('NODE_ENV', 'development')
    const r = await fetch(`${base}/api/test-email`, { method: 'POST' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ sent: true })
    expect(brevo).toHaveBeenCalledTimes(1)
  })

  it('unknown and inherited route names are 404, not a crash', async () => {
    for (const name of ['nope', 'constructor', '__proto__', 'toString']) {
      expect((await fetch(`${base}/api/${name}`)).status).toBe(404)
    }
  })

  it('malformed JSON is a 400 and the body is never logged', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await fetch(`${base}/api/join`, { method: 'POST', body: '{"email":"secret@example.com",' })
    expect(r.status).toBe(400)
    expect(JSON.stringify(err.mock.calls)).not.toContain('secret@example.com')
  })
})
