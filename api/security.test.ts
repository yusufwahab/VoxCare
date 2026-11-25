import { describe, expect, it, vi } from 'vitest'
import { route } from './_lib/http.js'
import { GENERIC_ERROR, HttpError } from './_lib/env.js'
import { sendAlertEmail } from './_lib/email.js'
import patient from './patient.js'
import alert from './alert.js'
import testEmail from './test-email.js'
import { testDb } from '../test/mocks/supabase.js'
import { json, mockFetch } from '../test/mocks/fetch.js'
import { invoke } from '../test/http.js'

const SECRET = 'row value j1_secret_token and mum@example.com'
const PATIENT = '33333333-3333-4333-8333-333333333333'

function captureLogs() {
  const lines: unknown[][] = []
  for (const m of ['log', 'warn', 'error'] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { lines.push(a) })
  return () => JSON.stringify(lines)
}

describe('generic server errors', () => {
  it('an unexpected error returns a generic message and logs only its type and path', async () => {
    const logs = captureLogs()
    const h = route(async () => { throw new TypeError(`cannot read ${SECRET}`) })
    const r = await invoke(h, { url: '/api/x?token=device-secret&joinToken=link-secret' })
    expect(r.status).toBe(500)
    expect(r.body).toEqual({ error: GENERIC_ERROR })
    expect(logs()).toContain('TypeError')
    expect(logs()).toContain('/api/x')
    for (const s of [SECRET, 'device-secret', 'link-secret']) expect(logs()).not.toContain(s)
  })

  it('a 5xx HttpError is hidden from the client unless written for users', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await invoke(route(async () => { throw new HttpError(502, 'Brevo error 401') }))).body).toEqual({ error: GENERIC_ERROR })
    expect((await invoke(route(async () => { throw new HttpError(503, 'Sign-in is down', undefined, true) }))).body).toEqual({ error: 'Sign-in is down' })
  })

  it('validation and authorization errors keep their status and message', async () => {
    expect(await invoke(route(async () => { throw new HttpError(400, 'Please check the email address') }))).toMatchObject({ status: 400, body: { error: 'Please check the email address' } })
    expect(await invoke(route(async () => { throw new HttpError(403, 'Not allowed') }))).toMatchObject({ status: 403, body: { error: 'Not allowed' } })
    expect(await invoke(route(async () => { throw new HttpError(429, 'Slow down', { 'Retry-After': '5' }) }))).toMatchObject({ status: 429, headers: { 'retry-after': '5' } })
  })

  it('malformed JSON is a 400, not a 500', async () => {
    const r = await invoke(patient, { body: '{"help_phone":' })
    expect(r.status).toBe(400)
  })
})

describe('sensitive information', () => {
  it('a database error on patient creation is not returned or logged', async () => {
    const logs = captureLogs()
    testDb.fail('patients', { op: 'insert', message: SECRET, code: '23505' })
    const r = await invoke(patient, { body: { help_phone: '08012345678' } })
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.body)).not.toContain('j1_secret')
    expect(logs()).toContain('23505')
    expect(logs()).not.toContain('j1_secret')
  })

  it('a database error loading a patient is not returned or logged', async () => {
    const logs = captureLogs()
    testDb.fail('patients', { op: 'select', message: SECRET })
    const r = await invoke(alert, { body: { patientId: PATIENT } })
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.body) + logs()).not.toContain('j1_secret')
  })

  it('a Brevo error body (which can echo the address) is not kept in the error', async () => {
    mockFetch([['https://api.brevo.com/', () => json({ message: 'invalid recipient mum@example.com' }, 400)]])
    const e = await sendAlertEmail({ to: 'mum@example.com', patientName: 'A', photoUrl: null, helpName: null, emergencyUrl: 'https://x.test/e/1' }).catch((x: Error) => x)
    expect(e).toBeInstanceOf(HttpError)
    expect((e as Error).message).toBe('Brevo error 400')
  })

  it('a sent alert logs neither the patient id (the emergency link) nor the email', async () => {
    const logs = captureLogs()
    mockFetch([['https://api.brevo.com/', () => json({}, 201)]])
    testDb.seed('patients', [{ id: PATIENT, name: 'Ada', help_phone: '08012345678', help_email: 'mum@example.com' }])
    expect((await invoke(alert, { body: { patientId: PATIENT } })).body).toEqual({ sent: true })
    expect(logs()).not.toContain(PATIENT)
    expect(logs()).not.toContain('mum@example.com')
  })
})

describe('test-email endpoint', () => {
  it.each([['NODE_ENV', 'production'], ['VERCEL_ENV', 'production']])('is 404 when %s=%s and calls nothing', async (name, value) => {
    const brevo = mockFetch([['https://api.brevo.com/', () => json({}, 201)]])
    vi.stubEnv(name, value)
    expect((await invoke(testEmail)).status).toBe(404)
    expect(brevo).not.toHaveBeenCalled()
  })
})
