import { beforeEach, describe, expect, it, vi } from 'vitest'
import patient from './patient.js'
import briefing from './briefing.js'
import join from './join.js'
import alert from './alert.js'
import emergency from './emergency.js'
import { ALERT_CLIENT, BRIEFING, JOIN, PATIENT_CREATE, PATIENT_CREATE_GLOBAL } from './_lib/limits.js'
import { testDb } from '../test/mocks/supabase.js'
import { json, mockFetch } from '../test/mocks/fetch.js'
import { invoke, type Call } from '../test/http.js'

// Paid YarnGPT work is replaced; everything else in the briefing module is real
vi.mock('./_lib/briefing.js', async (load) => ({ ...(await load<typeof import('./_lib/briefing.js')>()), ensureBriefings: async () => ({ generated: [], reused: [] }) }))

const PATIENT = '44444444-4444-4444-8444-444444444444'
const OTHER = '55555555-5555-4555-8555-555555555555'
const IP_A = '203.0.113.21'
const IP_B = '203.0.113.22'

type H = Parameters<typeof invoke>[0]
const post = (h: H, body: unknown, remoteAddress = IP_A, extra: Call = {}) => invoke(h, { body, remoteAddress, ...extra })
const create = (ip = IP_A) => post(patient, { help_phone: '08012345678' }, ip)
const brief = (ip = IP_A) => post(briefing, { patientId: PATIENT }, ip)
const joinBad = (ip = IP_A) => post(join, { joinToken: 'unknown-token-123', email: 'a@example.com' }, ip)
const raise = (id = PATIENT, ip = IP_A) => post(alert, { patientId: id }, ip)

let brevo: ReturnType<typeof mockFetch>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse('2026-11-25T12:00:00Z'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  brevo = mockFetch([['https://api.brevo.com/', () => json({}, 201)]])
  testDb.seed('patients', [
    { id: PATIENT, name: 'Ada', help_phone: '08012345678', help_email: 'mum@example.com' },
    { id: OTHER, name: 'Bola', help_phone: '08012345679', help_email: 'dad@example.com' },
  ])
})

async function useUp(n: number, fn: () => Promise<{ status: number }>) {
  for (let i = 0; i < n; i++) expect((await fn()).status).not.toBe(429)
}

describe.each([
  ['patient creation', PATIENT_CREATE, () => create()],
  ['briefing generation', BRIEFING, () => brief()],
  ['joining', JOIN, () => joinBad()],
  ['alerts', ALERT_CLIENT, () => raise(OTHER)],
])('%s', (_name, limit, call) => {
  it('works up to the limit, then returns 429 with Retry-After', async () => {
    await useUp(limit.limit, call)
    const r = await call()
    expect(r.status).toBe(429)
    const retry = Number(r.headers['retry-after'])
    expect(retry).toBeGreaterThan(0)
    expect(retry).toBeLessThanOrEqual(limit.windowMs / 1000)
  })

  it('opens again when the window has passed', async () => {
    await useUp(limit.limit, call)
    expect((await call()).status).toBe(429)
    vi.setSystemTime(Date.now() + limit.windowMs)
    expect((await call()).status).not.toBe(429)
  })
})

describe('concurrent requests', () => {
  it('cannot get more than the limit through at once', async () => {
    const rs = await Promise.all(Array.from({ length: PATIENT_CREATE.limit + 5 }, () => create()))
    expect(rs.filter((r) => r.status === 200)).toHaveLength(PATIENT_CREATE.limit)
    expect(rs.filter((r) => r.status === 429)).toHaveLength(5)
    expect(testDb.rows('patients')).toHaveLength(2 + PATIENT_CREATE.limit)
  })

  it('parallel alerts for one patient send exactly one email', async () => {
    const rs = await Promise.all([raise(), raise(PATIENT, IP_B), raise()])
    // The parallel requests wait for the one in flight and report its real outcome
    expect(rs.map((r) => r.body)).toEqual([{ sent: true }, { sent: true }, { sent: true }])
    expect(brevo).toHaveBeenCalledTimes(1)
    expect(testDb.rows('alerts')).toHaveLength(1)
  })
})

describe('independent limits', () => {
  it('using up one endpoint does not affect the others', async () => {
    await useUp(JOIN.limit, () => joinBad())
    expect((await joinBad()).status).toBe(429)
    expect((await create()).status).toBe(200)
    expect((await brief()).status).toBe(200)
    expect((await raise()).body).toEqual({ sent: true })
  })

  it('one client using up its limit does not block another client', async () => {
    await useUp(BRIEFING.limit, () => brief(IP_A))
    expect((await brief(IP_A)).status).toBe(429)
    expect((await brief(IP_B)).status).toBe(200)
  })

  it('the global patient-creation cap stops creation from many addresses', async () => {
    for (let i = 0; i < PATIENT_CREATE_GLOBAL.limit; i++) expect((await create(`198.51.100.${i % 250}`)).status).not.toBe(429)
    const r = await create('192.0.2.200')
    expect(r.status).toBe(429)
    expect(r.headers['retry-after']).toBeTruthy()
  })
})

describe('legitimate emergency use', () => {
  it('reading the emergency page is never limited', async () => {
    for (let i = 0; i < 60; i++) expect((await invoke(emergency, { method: 'GET', query: { id: PATIENT }, remoteAddress: IP_A })).status).toBe(200)
  })

  it('alerts for different patients are independent, and a patient can be alerted again after 10 minutes', async () => {
    expect((await raise(PATIENT)).body).toEqual({ sent: true })
    expect((await raise(OTHER)).body).toEqual({ sent: true })
    expect((await raise(PATIENT)).body).toEqual({ sent: true, reason: 'rate_limited' })
    vi.setSystemTime(Date.now() + 10 * 60_000 + 1)
    expect((await raise(PATIENT)).body).toEqual({ sent: true })
    expect(brevo).toHaveBeenCalledTimes(3)
  })

  it('a failed email does not block the next alert attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch([['https://api.brevo.com/', () => json({}, 500)]])
    expect((await raise()).status).toBe(502)
    brevo = mockFetch([['https://api.brevo.com/', () => json({}, 201)]])
    expect((await raise()).body).toEqual({ sent: true })
  })

  it('a parallel request never reports sent while the email in flight fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch([['https://api.brevo.com/', () => json({}, 500)]])
    const rs = await Promise.all([raise(), raise(PATIENT, IP_B)])
    expect(rs.map((r) => r.status)).toEqual([502, 502])
    expect(rs.some((r) => r.body.sent === true)).toBe(false)
    expect(testDb.rows('alerts')).toHaveLength(0)
  })

  it('a bad location is dropped and the alert still goes out', async () => {
    const r = await post(alert, { patientId: PATIENT, lat: 200, lng: 'x' })
    expect(r.body).toEqual({ sent: true })
    expect(testDb.rows('alerts')[0]).toMatchObject({ lat: null, lng: null })
  })

  it('a valid location is kept', async () => {
    await post(alert, { patientId: PATIENT, lat: 6.5244, lng: 3.3792 })
    expect(testDb.rows('alerts')[0]).toMatchObject({ lat: 6.5244, lng: 3.3792 })
  })

  it('rejects a malformed patient id before counting', async () => {
    expect((await raise('not-a-uuid')).status).toBe(404)
    expect((await post(alert, {})).status).toBe(404)
  })
})
