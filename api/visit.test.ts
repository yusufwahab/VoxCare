import { beforeEach, describe, expect, it, vi } from 'vitest'
import visit from './visit.js'
import visitEvents from './visit-events.js'
import { signDoctor } from './_lib/supabase.js'
import { testDb } from '../test/mocks/supabase.js'
import { invoke } from '../test/http.js'

const DOC = 'd0c70000-0000-4000-8000-000000000031'
const VISIT = '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  testDb.seed('visits', [{ id: VISIT, doctor_id: DOC, code: '123456', mode: 'one', status: 'active', transcript: [], started_at: new Date().toISOString() }])
})

describe('/api/visit (merged from main)', () => {
  it('starting a visit needs a signed-in doctor', async () => {
    expect((await invoke(visit, { body: { mode: 'one' } })).status).toBe(401)
    const r = await invoke(visit, { body: { mode: 'two' }, headers: { authorization: `Bearer ${signDoctor(DOC)}` } })
    expect(r.status).toBe(200)
    expect(r.body.code).toMatch(/^\d{6}$/)
  })

  it('a code lookup never returns the conversation', async () => {
    const r = await invoke(visit, { method: 'GET', url: '/api/visit?code=123456', query: { code: '123456' } })
    expect(r.status).toBe(200)
    expect(r.body).not.toHaveProperty('transcript')
  })

  it('code guessing is limited per client, and a fake X-Forwarded-For does not reset it', async () => {
    const guess = (i: number) => invoke(visit, { method: 'GET', url: '/api/visit', query: { code: String(100000 + i) }, headers: { 'x-forwarded-for': `198.51.100.${i % 250}` } })
    for (let i = 0; i < 30; i++) expect((await guess(i)).status).toBe(404)
    expect((await guess(31)).status).toBe(429)
  })

  it('events need the right code', async () => {
    const events = [{ id: 'e1', type: 'patient.said' }]
    expect((await invoke(visitEvents, { body: { visitId: VISIT, code: '654321', events } })).status).toBe(404)
  })
})
