import { describe, expect, it } from 'vitest'
import { json, mockFetch } from '../../test/mocks/fetch'
import { doctorLogin, saveErrorMessage, saveVerifiedFacts } from './api'

const doctor = { id: 'd1', name: 'Dr. Test', mdcn_number: 'MDCN/R/1', verified: true }

describe('doctorLogin (browser client)', () => {
  it('returns the doctor on success', async () => {
    const f = mockFetch([['/api/doctor-login', () => json({ doctor, token: 'signed-token' })]])
    expect(await doctorLogin('4821')).toEqual(doctor)
    expect(JSON.parse(f.mock.calls[0][1]!.body as string)).toEqual({ pin: '4821' })
  })

  it('returns null for a wrong PIN', async () => {
    mockFetch([['/api/doctor-login', () => json({ doctor: null })]])
    expect(await doctorLogin('9090')).toBeNull()
  })

  it('surfaces the server message when rate limited, so the PIN screen can show it', async () => {
    mockFetch([['/api/doctor-login', () => json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429, { 'retry-after': '900' })]])
    await expect(doctorLogin('4821')).rejects.toThrow('Too many attempts. Wait a few minutes and try again.')
  })

  it('surfaces the server message when sign-in is unavailable', async () => {
    mockFetch([['/api/doctor-login', () => json({ error: 'Sign-in is not available right now. Try again soon.' }, 503)]])
    await expect(doctorLogin('4821')).rejects.toThrow('Sign-in is not available right now.')
  })
})

describe('saveVerifiedFacts (browser client)', () => {
  const args = { patientId: 'p1', doctorId: 'd1', visitId: 'v1', facts: [], transcript: [], summary: '' }

  it('makes one request and no separate briefing request (the server regenerates it)', async () => {
    const f = mockFetch([['/api/verify', () => json({ ok: true })]])
    await saveVerifiedFacts(args)
    expect(f.mock.calls.map((c) => String(c[0]))).toEqual(['/api/verify'])
    expect(JSON.parse(f.mock.calls[0][1]!.body as string).visitId).toBe('v1')
  })

  it('throws when the server did not save, so the screen can offer a retry', async () => {
    mockFetch([['/api/verify', () => json({ error: 'Something went wrong. Please try again.' }, 500)]])
    await expect(saveVerifiedFacts(args)).rejects.toThrow('Something went wrong.')
  })

  it('turns timeouts and network failures into readable messages', () => {
    expect(saveErrorMessage(new DOMException('t', 'TimeoutError'))).toBe('The server took too long. Try again.')
    expect(saveErrorMessage(new TypeError('fetch failed'))).toContain('Could not reach the server')
    expect(saveErrorMessage(new Error('Not allowed'))).toBe('Not allowed')
  })
})
