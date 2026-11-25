import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout, TIMEOUTS } from './_lib/fetchTimeout.js'
import { sendAlertEmail } from './_lib/email.js'
import { ensureBriefings } from './_lib/briefing.js'
import { HttpError } from './_lib/env.js'
import alert from './alert.js'
import { testDb } from '../test/mocks/supabase.js'
import { json, mockFetch } from '../test/mocks/fetch.js'
import { invoke } from '../test/http.js'

const PATIENT = '99999999-9999-4999-8999-999999999999'

/** A service that never answers, but stops when the request is aborted (as real fetch does) */
const hang = (_url: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))

const realTimeout = AbortSignal.timeout.bind(AbortSignal)
let asked: number[]
beforeEach(() => {
  asked = []
  // Real timers, but 5 ms instead of seconds, recording what each call asked for
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => { asked.push(ms); return realTimeout(5) })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('fetchWithTimeout', () => {
  it('turns a hang into a 504 that names only the service', async () => {
    mockFetch([[/./, hang]])
    const e = await fetchWithTimeout('YarnGPT', 'https://api.yarngpt.ai/api/v1/status/secret-job-id', {}, 15_000).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(HttpError)
    expect((e as HttpError).status).toBe(504)
    expect((e as HttpError).message).toBe('YarnGPT timed out')
    expect(asked).toEqual([15_000])
  })

  it('turns a network failure into a 502 without the URL', async () => {
    mockFetch([[/./, () => { throw new TypeError('fetch failed https://signed.example/audio?token=abc') }]])
    const e = (await fetchWithTimeout('YarnGPT audio', 'https://signed.example/audio?token=abc', {}, 30_000).catch((x: unknown) => x)) as HttpError
    expect(e.status).toBe(502)
    expect(e.message).toBe('YarnGPT audio unreachable')
  })

  it('passes a normal response through', async () => {
    mockFetch([[/./, () => json({ ok: 1 })]])
    expect((await fetchWithTimeout('Brevo', 'https://api.brevo.com/x', {}, 10_000)).status).toBe(200)
  })
})

describe('Brevo', () => {
  it('an email that hangs fails after the Brevo timeout', async () => {
    mockFetch([['https://api.brevo.com/', hang]])
    const e = (await sendAlertEmail({ to: 'mum@example.com', patientName: 'A', photoUrl: null, helpName: null, emergencyUrl: 'https://x.test/e/1' }).catch((x: unknown) => x)) as HttpError
    expect(e.status).toBe(504)
    expect(asked).toEqual([TIMEOUTS.brevo])
  })

  it('an emergency alert that times out is reported as failed, not sent, and can be retried', async () => {
    testDb.seed('patients', [{ id: PATIENT, name: 'Ada', help_phone: '08012345678', help_email: 'mum@example.com' }])
    mockFetch([['https://api.brevo.com/', hang]])
    const r = await invoke(alert, { body: { patientId: PATIENT } })
    expect(r.status).toBe(504)
    expect(r.body.sent).toBeUndefined()
    expect(JSON.stringify(r.body)).not.toContain('mum@example.com')
    expect(testDb.rows('alerts')).toHaveLength(0)

    mockFetch([['https://api.brevo.com/', () => json({}, 201)]])
    expect((await invoke(alert, { body: { patientId: PATIENT } })).body).toEqual({ sent: true })
  })
})

describe('YarnGPT', () => {
  it('a briefing whose voice list hangs fails with a timeout instead of waiting forever', async () => {
    testDb.seed('patients', [{ id: PATIENT, name: 'Ada', help_phone: '08012345678' }])
    testDb.seed('facts', [{ patient_id: PATIENT, type: 'allergy', value: 'Penicillin', status: 'doctor_verified', verified_at: '2026-11-25T10:00:00Z' }])
    mockFetch([['https://api.yarngpt.ai/', hang]])
    const e = (await ensureBriefings(PATIENT).catch((x: unknown) => x)) as HttpError
    expect(e.status).toBe(504)
    expect(e.message).toBe('YarnGPT timed out')
    expect(asked).toContain(TIMEOUTS.yarnApi)
  })
})
