import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './join.js'
import { sha256 } from './_lib/supabase.js'
import { isExpired, issuedAt, JOIN_TTL_MS, newJoinToken } from './_lib/invite.js'
import { testDb } from '../test/mocks/supabase.js'
import { json, mockFetch } from '../test/mocks/fetch.js'
import { invoke, type Call } from '../test/http.js'

const T0 = Date.parse('2026-11-20T10:00:00Z')
const PATIENT = '11111111-1111-4111-8111-111111111111'
const DEVICE = 'device-secret-token-for-tests'
const EMAIL = 'helper@example.com'

let joinToken: string

function seedPatient(over: Record<string, unknown> = {}) {
  testDb.seed('patients', [{
    id: PATIENT, name: 'Ada', photo_url: null, help_phone: '08012345678', help_name: 'Mum',
    help_email: null, help_join_token: joinToken, help_confirmed_at: null,
    created_at: new Date(T0).toISOString(), token_hash: sha256(DEVICE), ...over,
  }])
}
const patient = () => testDb.rows('patients').find((r) => r.id === PATIENT)!

const join = (body: unknown, call: Call = {}) => invoke(handler, { body, url: '/api/join', ...call })
const reinvite = (...args: [token?: unknown, patientId?: unknown]) => join({ action: 'reinvite', patientId: args.length > 1 ? args[1] : PATIENT, token: args.length > 0 ? args[0] : DEVICE })
const info = (token: string) => invoke(handler, { method: 'GET', url: `/api/join?joinToken=${token}`, query: { joinToken: token } })
const status = (token = DEVICE) => invoke(handler, { method: 'GET', url: '/api/join', query: { patientId: PATIENT, token } })

let brevo: ReturnType<typeof mockFetch>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0 + 3600_000)
  joinToken = newJoinToken(T0)
  brevo = mockFetch([['https://api.brevo.com/', () => json({ messageId: 'x' }, 201)]])
})

describe('invite tokens', () => {
  it('carry their issue time; legacy tokens fall back to created_at', () => {
    expect(issuedAt(newJoinToken(T0), null)).toBe(T0)
    expect(issuedAt('a'.repeat(48), new Date(T0).toISOString())).toBe(T0)
    expect(issuedAt('a'.repeat(48), null)).toBeNull()
  })

  it('expire after the TTL, and a token with no known or a future issue time counts as expired', () => {
    expect(isExpired(newJoinToken(T0), null, T0 + JOIN_TTL_MS - 1)).toBe(false)
    expect(isExpired(newJoinToken(T0), null, T0 + JOIN_TTL_MS)).toBe(true)
    expect(isExpired('a'.repeat(48), null, T0)).toBe(true)
    expect(isExpired(newJoinToken(T0 + 3600_000), null, T0)).toBe(true)
  })
})

describe('successful registration', () => {
  it('saves the help person once and sends a welcome email', async () => {
    seedPatient()
    const r = await join({ joinToken, email: '  Helper@Example.com ' })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true })
    expect(patient().help_email).toBe(EMAIL)
    expect(patient().help_confirmed_at).toBeTruthy()
    await vi.waitFor(() => expect(brevo).toHaveBeenCalledTimes(1))
    expect((await status()).body).toEqual({ confirmed: true, link_expired: false })
  })

  it('shows who invited them, without private fields', async () => {
    seedPatient()
    const r = await info(joinToken)
    expect(r.body).toEqual({ name: 'Ada', photo_url: null, joined: false })
  })

  it('accepts a legacy token within the TTL of created_at', async () => {
    joinToken = 'b'.repeat(48)
    seedPatient()
    expect((await join({ joinToken, email: EMAIL })).status).toBe(200)
  })
})

describe('expired invitations', () => {
  it('are refused and leave the record untouched', async () => {
    seedPatient()
    vi.setSystemTime(T0 + JOIN_TTL_MS)
    const r = await join({ joinToken, email: EMAIL })
    expect(r.status).toBe(410)
    expect(patient().help_email).toBeNull()
    expect((await info(joinToken)).status).toBe(410)
    expect((await status()).body).toEqual({ confirmed: false, link_expired: true })
    expect(brevo).not.toHaveBeenCalled()
  })

  it('a legacy token expires from created_at', async () => {
    joinToken = 'c'.repeat(48)
    seedPatient({ created_at: new Date(T0 - JOIN_TTL_MS).toISOString() })
    expect((await join({ joinToken, email: EMAIL })).status).toBe(410)
  })
})

describe('repeated use', () => {
  it('a second join with the same link cannot replace the help person', async () => {
    seedPatient()
    expect((await join({ joinToken, email: EMAIL })).status).toBe(200)
    const r = await join({ joinToken, email: 'attacker@example.com' })
    expect(r.status).toBe(409)
    expect(patient().help_email).toBe(EMAIL)
  })

  it('a joined link stays used even after it would have expired', async () => {
    seedPatient({ help_email: EMAIL, help_confirmed_at: new Date(T0).toISOString() })
    vi.setSystemTime(T0 + 2 * JOIN_TTL_MS)
    expect((await join({ joinToken, email: 'attacker@example.com' })).status).toBe(409)
    expect((await info(joinToken)).body.joined).toBe(true)
  })
})

describe('concurrent requests', () => {
  it('only one of two simultaneous joins wins, and the winner is kept', async () => {
    seedPatient()
    const [a, b] = await Promise.all([
      join({ joinToken, email: 'first@example.com' }),
      join({ joinToken, email: 'second@example.com' }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const winner = a.status === 200 ? 'first@example.com' : 'second@example.com'
    expect(patient().help_email).toBe(winner)
    await vi.waitFor(() => expect(brevo).toHaveBeenCalledTimes(1))
  })

  it('a join racing a replacement cannot use the replaced link', async () => {
    seedPatient()
    const [j, re] = await Promise.all([join({ joinToken, email: EMAIL }), reinvite()])
    // Either the join landed first (the replacement is then refused) or the link was replaced first
    if (j.status === 200) expect(re.status).toBe(409)
    else { expect(j.status).toBe(409); expect(patient().help_email).toBeNull() }
  })
})

describe('replacement invitations', () => {
  it('need the device token, and invalidate the previous link', async () => {
    seedPatient()
    vi.setSystemTime(T0 + JOIN_TTL_MS + 1)
    const r = await reinvite()
    expect(r.status).toBe(200)
    expect(r.body.join_token).toMatch(/^j1_/)
    expect(r.body.join_token).not.toBe(joinToken)
    expect(patient().help_join_token).toBe(r.body.join_token)
    // The replacement has a fresh expiry even though created_at is old
    expect((await join({ joinToken, email: 'old@example.com' })).status).toBe(404)
    expect((await join({ joinToken: r.body.join_token, email: EMAIL })).status).toBe(200)
  })

  it.each([
    ['a wrong device token', 'wrong-device-token-xx', PATIENT],
    ['a missing device token', undefined, PATIENT],
    ['a non-string device token', { $ne: null }, PATIENT],
    ['an unknown patient', DEVICE, '22222222-2222-4222-8222-222222222222'],
    ['a malformed patient id', DEVICE, "1' or '1'='1"],
  ])('are refused with %s', async (_label, token, patientId) => {
    seedPatient()
    const r = await reinvite(token, patientId)
    expect(r.status).toBe(403)
    expect(patient().help_join_token).toBe(joinToken)
  })

  it('are refused for a patient with no device token (the demo patient)', async () => {
    seedPatient({ token_hash: null })
    expect((await reinvite()).status).toBe(403)
  })

  it('are refused once a help person has joined', async () => {
    seedPatient({ help_email: EMAIL, help_confirmed_at: new Date(T0).toISOString() })
    expect((await reinvite()).status).toBe(409)
    expect(patient().help_join_token).toBe(joinToken)
  })

  it('the status check also needs the device token', async () => {
    seedPatient()
    expect((await status('wrong-device-token-xx')).status).toBe(403)
  })
})

describe('input validation', () => {
  it.each([
    ['no email', { joinToken }],
    ['a bad email', { joinToken, email: 'not-an-email' }],
    ['a non-string email', { joinToken, email: ['a@b.co'] }],
    ['a too long email', { joinToken, email: `${'a'.repeat(120)}@example.com` }],
  ])('rejects %s with 400', async (_label, body) => {
    seedPatient()
    expect((await join(body)).status).toBe(400)
    expect(patient().help_email).toBeNull()
  })

  it.each([
    ['a missing token', undefined],
    ['a short token', 'abc'],
    ['a non-string token', { $ne: null }],
    ['an unknown token', newJoinToken(T0)],
  ])('rejects %s with 404', async (_label, token) => {
    seedPatient()
    expect((await join({ joinToken: token, email: EMAIL })).status).toBe(404)
  })

  it('rejects malformed JSON, unknown actions and other methods', async () => {
    expect((await join('{not json')).status).toBe(400)
    expect((await join({ action: 'delete' })).status).toBe(400)
    expect((await invoke(handler, { method: 'PUT', body: {} })).status).toBe(405)
  })
})

describe('database failures', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })

  it.each([
    ['the invite lookup', { op: 'select' as const }],
    ['the join update', { op: 'update' as const }],
  ])('a failure in %s returns a generic 500 and sends no email', async (_label, opts) => {
    seedPatient()
    testDb.fail('patients', { ...opts, message: 'relation "patients" secret detail' })
    const r = await join({ joinToken, email: EMAIL })
    expect(r.status).toBe(500)
    expect(r.body.error).not.toContain('secret detail')
    expect(brevo).not.toHaveBeenCalled()
  })

  it('a failed replacement keeps the old link', async () => {
    seedPatient()
    testDb.fail('patients', { op: 'update' })
    expect((await reinvite()).status).toBe(500)
    expect(patient().help_join_token).toBe(joinToken)
  })

  it('the join is kept if the welcome email fails', async () => {
    seedPatient()
    mockFetch([['https://api.brevo.com/', () => json({ message: `bad ${EMAIL}` }, 400)]])
    expect((await join({ joinToken, email: EMAIL })).status).toBe(200)
    expect(patient().help_email).toBe(EMAIL)
  })
})

describe('logs', () => {
  it('never contain join links, device tokens, emails or database details', async () => {
    const lines: string[] = []
    const capture = (...a: unknown[]) => { lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) }
    vi.spyOn(console, 'error').mockImplementation(capture)
    vi.spyOn(console, 'warn').mockImplementation(capture)
    vi.spyOn(console, 'log').mockImplementation(capture)
    seedPatient()
    mockFetch([['https://api.brevo.com/', () => json({ message: `bad ${EMAIL}` }, 400)]])
    await join({ joinToken, email: EMAIL })
    testDb.fail('patients', { message: 'secret detail' })
    await info(joinToken)
    testDb.fail('patients', { message: 'secret detail' })
    await invoke(handler, { method: 'GET', url: `/api/join?patientId=${PATIENT}&token=${DEVICE}`, query: { patientId: PATIENT, token: DEVICE } })
    await vi.waitFor(() => expect(lines.some((l) => l.includes('welcome email failed'))).toBe(true))
    expect(lines.length).toBeGreaterThan(0)
    const all = lines.join('\n')
    for (const secret of [joinToken, DEVICE, EMAIL, 'secret detail']) expect(all).not.toContain(secret)
  })
})
