import { describe, expect, it } from 'vitest'
import { json, mockFetch } from '../../test/mocks/fetch'
import { doctorLogin } from './api'

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
