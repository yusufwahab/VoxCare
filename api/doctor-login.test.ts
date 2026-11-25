import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { GLOBAL_LIMIT, LOGIN_WINDOW_MS, PER_CLIENT_LIMIT } from './doctor-login.js'
import { requireDoctor, sha256 } from './_lib/supabase.js'
import { testDb } from '../test/mocks/supabase.js'
import { invoke, type Call } from '../test/http.js'
import { TEST_ENV } from '../test/env.js'

const DOCTOR = { id: 'd0c70000-0000-4000-8000-000000000002', name: 'Dr. Test Adeyemi', mdcn_number: 'MDCN/R/99999', verified: true }
const GOOD_PIN = '4821'
const WRONG_PIN = '9090'
const hash = (pin: string) => sha256(`voxcare:${pin}`)

beforeEach(() => {
  testDb.seed('doctors', [
    { ...DOCTOR, pin: hash(GOOD_PIN) },
    { id: 'demo-doctor', name: 'Dr. Demo', mdcn_number: 'MDCN/R/12345', verified: true, pin: hash('1234') },
    { id: 'pending-doctor', name: 'Dr. Pending', mdcn_number: 'MDCN/R/00000', verified: false, pin: hash('5555') },
  ])
})

const login = (pin: unknown, call: Call = {}) => invoke(handler, { body: { pin }, ...call })
const doctorQueries = () => testDb.calls.filter((c) => c.table === 'doctors').length
const fromIp = (remoteAddress: string, headers?: Record<string, string>): Call => ({ remoteAddress, headers })

async function useUpClientLimit(call: Call = {}) {
  for (let i = 0; i < PER_CLIENT_LIMIT; i++) expect((await login(WRONG_PIN, call)).status).toBe(200)
}

describe('successful sign-in', () => {
  it('returns the doctor and a session token that the API accepts', async () => {
    const r = await login(GOOD_PIN)
    expect(r.status).toBe(200)
    expect(r.body.doctor).toEqual(DOCTOR)
    expect(requireDoctor(`Bearer ${r.body.token}`)).toBe(DOCTOR.id)
  })

  it('never returns the PIN or its hash', async () => {
    const r = await login(GOOD_PIN)
    expect(r.body.doctor).not.toHaveProperty('pin')
    expect(JSON.stringify(r.body)).not.toContain(hash(GOOD_PIN))
  })
})

describe('wrong credentials', () => {
  it('a wrong PIN returns no doctor and no token', async () => {
    const r = await login(WRONG_PIN)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ doctor: null })
  })

  it('an unverified doctor cannot sign in', async () => {
    expect((await login('5555')).body).toEqual({ doctor: null })
  })

  it('a PIN shared by two verified doctors is refused rather than guessing which one', async () => {
    testDb.seed('doctors', [
      { id: 'a', name: 'A', mdcn_number: '1', verified: true, pin: hash('7777') },
      { id: 'b', name: 'B', mdcn_number: '2', verified: true, pin: hash('7777') },
    ])
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await login('7777')).body).toEqual({ doctor: null })
  })
})

describe('malformed or missing credentials', () => {
  it.each([
    ['no body', undefined],
    ['empty object', {}],
    ['PIN as a number', { pin: 4821 }],
    ['PIN as null', { pin: null }],
    ['three digits', { pin: '482' }],
    ['five digits', { pin: '48211' }],
    ['letters', { pin: '48a1' }],
    ['surrounding space', { pin: ' 4821' }],
    ['array body', ['4821']],
    ['broken JSON text', '{"pin":'],
  ])('%s gets 400 without touching the database', async (_name, body) => {
    const r = await invoke(handler, { body })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ error: 'Invalid request' })
    expect(doctorQueries()).toBe(0)
  })

  it('malformed requests do not use up the attempt budget', async () => {
    for (let i = 0; i < 20; i++) await invoke(handler, { body: { pin: 'x' } })
    expect((await login(GOOD_PIN)).body.doctor).toEqual(DOCTOR)
  })
})

describe('repeated failed attempts and rate limiting', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it(`refuses the attempt after ${PER_CLIENT_LIMIT} wrong PINs, even with the right PIN`, async () => {
    await useUpClientLimit()
    const r = await login(GOOD_PIN)
    expect(r.status).toBe(429)
    expect(r.body).toEqual({ error: 'Too many attempts. Wait a few minutes and try again.' })
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
    expect(Number(r.headers['retry-after'])).toBeLessThanOrEqual(LOGIN_WINDOW_MS / 1000)
    expect(doctorQueries()).toBe(PER_CLIENT_LIMIT)
  })

  it('a successful sign-in clears that client’s count', async () => {
    for (let i = 0; i < PER_CLIENT_LIMIT - 1; i++) await login(WRONG_PIN)
    expect((await login(GOOD_PIN)).body.doctor).toEqual(DOCTOR)
    await useUpClientLimit()
    expect((await login(WRONG_PIN)).status).toBe(429)
  })

  it('the limit expires after the window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await useUpClientLimit()
    expect((await login(GOOD_PIN)).status).toBe(429)
    vi.setSystemTime(Date.now() + LOGIN_WINDOW_MS - 1000)
    expect((await login(GOOD_PIN)).status).toBe(429)
    vi.setSystemTime(Date.now() + 2000)
    expect((await login(GOOD_PIN)).body.doctor).toEqual(DOCTOR)
  })

  it('each client is limited separately', async () => {
    await useUpClientLimit(fromIp('203.0.113.1'))
    expect((await login(GOOD_PIN, fromIp('203.0.113.1'))).status).toBe(429)
    expect((await login(GOOD_PIN, fromIp('203.0.113.2'))).body.doctor).toEqual(DOCTOR)
  })

  it('parallel requests cannot slip past the limit', async () => {
    const replies = await Promise.all(Array.from({ length: 20 }, () => login(WRONG_PIN)))
    expect(replies.filter((r) => r.status === 200)).toHaveLength(PER_CLIENT_LIMIT)
    expect(replies.filter((r) => r.status === 429)).toHaveLength(20 - PER_CLIENT_LIMIT)
    expect(doctorQueries()).toBe(PER_CLIENT_LIMIT)
  })

  it(`slows guessing spread over many addresses: ${GLOBAL_LIMIT} failures in total lock sign-in for everyone`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let i = 0; i < GLOBAL_LIMIT; i++) expect((await login(WRONG_PIN, fromIp(`198.51.100.${i}`))).status).toBe(200)
    // Documented trade-off: a fresh address with the right PIN is also refused until the window passes
    expect((await login(GOOD_PIN, fromIp('192.0.2.200'))).status).toBe(429)
    vi.setSystemTime(Date.now() + LOGIN_WINDOW_MS + 1000)
    expect((await login(GOOD_PIN, fromIp('192.0.2.200'))).body.doctor).toEqual(DOCTOR)
  })

  it('successful sign-ins do not use up the shared budget', async () => {
    for (let i = 0; i < GLOBAL_LIMIT + 10; i++) expect((await login(GOOD_PIN, fromIp(`198.51.100.${i}`))).status).toBe(200)
  })
})

describe('spoofed forwarding headers cannot bypass the limit', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('a client connecting directly cannot choose its address with X-Forwarded-For', async () => {
    for (let i = 0; i < PER_CLIENT_LIMIT; i++) await login(WRONG_PIN, fromIp('203.0.113.50', { 'X-Forwarded-For': `1.2.3.${i}` }))
    expect((await login(GOOD_PIN, fromIp('203.0.113.50', { 'X-Forwarded-For': '9.9.9.9' }))).status).toBe(429)
  })

  it('behind the proxy, only the address the proxy appended counts', async () => {
    const viaProxy = (spoofed: string) => fromIp('10.0.0.5', { 'X-Forwarded-For': `${spoofed}, 198.51.100.7` })
    for (let i = 0; i < PER_CLIENT_LIMIT; i++) await login(WRONG_PIN, viaProxy(`1.2.3.${i}`))
    expect((await login(GOOD_PIN, viaProxy('8.8.8.8'))).status).toBe(429)
  })

  it('behind the proxy, different real clients are still limited separately', async () => {
    for (let i = 0; i < PER_CLIENT_LIMIT; i++) await login(WRONG_PIN, fromIp('10.0.0.5', { 'X-Forwarded-For': '198.51.100.7' }))
    expect((await login(GOOD_PIN, fromIp('10.0.0.5', { 'X-Forwarded-For': '198.51.100.8' }))).body.doctor).toEqual(DOCTOR)
  })

  it('rotating IPv6 addresses inside one /64 does not reset the count', async () => {
    for (let i = 1; i <= PER_CLIENT_LIMIT; i++) await login(WRONG_PIN, fromIp(`2001:db8:1:2::${i}`))
    expect((await login(GOOD_PIN, fromIp('2001:db8:1:2:ffff::99'))).status).toBe(429)
  })

  it('a garbage header from behind the proxy is ignored safely', async () => {
    const r = await login(GOOD_PIN, fromIp('10.0.0.5', { 'X-Forwarded-For': 'not-an-ip' }))
    expect(r.body.doctor).toEqual(DOCTOR)
  })
})

describe('public demo credentials', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it.each([['NODE_ENV'], ['VERCEL_ENV']])('are refused when %s is production, without querying the database', async (name) => {
    vi.stubEnv(name, 'production')
    expect((await login('1234')).body).toEqual({ doctor: null })
    expect(doctorQueries()).toBe(0)
  })

  it('count as a failed attempt in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (let i = 0; i < PER_CLIENT_LIMIT; i++) await login('1234')
    expect((await login(GOOD_PIN)).status).toBe(429)
  })

  it('a real PIN still works in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect((await login(GOOD_PIN)).body.doctor).toEqual(DOCTOR)
  })

  it('still work outside production, for local demos', async () => {
    expect((await login('1234')).body.doctor.id).toBe('demo-doctor')
  })
})

describe('database failures', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('return a generic 503 without database details', async () => {
    testDb.fail('doctors', { message: 'relation "doctors" INTERNAL-DETAIL', code: 'XX000' })
    const r = await login(GOOD_PIN)
    expect(r.status).toBe(503)
    expect(r.body).toEqual({ error: 'Sign-in is not available right now. Try again soon.' })
    expect(JSON.stringify(r.body)).not.toContain('INTERNAL-DETAIL')
  })

  it('do not count against the doctor', async () => {
    testDb.fail('doctors', { times: PER_CLIENT_LIMIT * 2 })
    for (let i = 0; i < PER_CLIENT_LIMIT * 2; i++) expect((await login(GOOD_PIN)).status).toBe(503)
    expect((await login(GOOD_PIN)).body.doctor).toEqual(DOCTOR)
  })
})

describe('no sensitive information in logs or responses', () => {
  it('logs and error bodies never contain PINs, hashes, tokens, keys or client addresses', async () => {
    const logged: unknown[][] = []
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args) })
    }
    const ip = '203.0.113.77'
    const ok = await login(GOOD_PIN, fromIp(ip))
    const bodies: unknown[] = [ok.body]
    for (let i = 0; i < PER_CLIENT_LIMIT + 1; i++) bodies.push((await login(WRONG_PIN, fromIp(ip))).body)
    testDb.fail('doctors', { message: `failed for pin ${hash(GOOD_PIN)}` })
    bodies.push((await login(GOOD_PIN, fromIp('203.0.113.78'))).body)
    vi.stubEnv('NODE_ENV', 'production')
    bodies.push((await login('1234', fromIp('203.0.113.79'))).body)

    const logText = JSON.stringify(logged)
    const errorText = JSON.stringify(bodies.slice(1))
    expect(logged.length).toBeGreaterThan(0)
    for (const secret of [GOOD_PIN, WRONG_PIN, hash(GOOD_PIN), hash(WRONG_PIN), ok.body.token, TEST_ENV.SUPABASE_SERVICE_ROLE_KEY, ip]) {
      expect(logText).not.toContain(secret)
      expect(errorText).not.toContain(secret)
    }
  })
})
