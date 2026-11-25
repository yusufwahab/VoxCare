import { beforeEach, describe, expect, it, vi } from 'vitest'
import emergency from './emergency.js'
import facts from './facts.js'
import { currentBriefing } from './_lib/briefing.js'
import { sha256, signDoctor } from './_lib/supabase.js'
import { testDb } from '../test/mocks/supabase.js'
import { invoke } from '../test/http.js'

// Paid YarnGPT work is replaced; the rest of the module is real
const ensure = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock('./_lib/briefing.js', async (load) => ({
  ...(await load<typeof import('./_lib/briefing.js')>()),
  ensureBriefings: async (id: string) => { ensure.calls.push(id); return { generated: [], reused: [] } },
}))

const PATIENT = '12121212-1212-4121-8121-121212121212'
const OTHER = '34343434-3434-4343-8343-343434343434'
const DOC = 'd0c70000-0000-4000-8000-000000000021'
const TOKEN = 'device-secret-token'
const TRANSCRIPT_TEXT = 'Private visit note: patient said something sensitive'

beforeEach(() => {
  ensure.calls = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
  testDb.seed('patients', [
    { id: PATIENT, name: 'Ada', photo_url: null, help_phone: '08012345678', help_name: 'Mum', help_email: 'mum@example.test', help_join_token: 'j1_secret', token_hash: sha256(TOKEN) },
    { id: OTHER, name: 'Bola', help_phone: '08012345679', token_hash: sha256('other-token') },
  ])
  testDb.seed('facts', [
    { id: 'f1', patient_id: PATIENT, type: 'allergy', value: 'Penicillin', status: 'doctor_verified', verified_by: DOC, verified_at: '2026-11-25T10:00:00Z' },
    { id: 'f2', patient_id: PATIENT, type: 'condition', value: 'Fainting', status: 'self_reported' },
    { id: 'f3', patient_id: OTHER, type: 'condition', value: 'Diabetes', status: 'doctor_verified' },
  ])
  testDb.seed('visits', [{ id: 'v1', patient_id: PATIENT, doctor_id: DOC, transcript: [{ text: TRANSCRIPT_TEXT }], summary: TRANSCRIPT_TEXT }])
})

describe('GET /api/emergency', () => {
  it('returns only the briefing subset: never transcripts, tokens, emails or doctor ids', async () => {
    const r = await invoke(emergency, { method: 'GET', url: `/api/emergency?id=${PATIENT}`, query: { id: PATIENT } })
    expect(r.status).toBe(200)
    const b = r.body as Record<string, unknown>
    expect(Object.keys(b).sort()).toEqual(['audio', 'help_name', 'help_phone', 'id', 'name', 'photo_url', 'text', 'unverified', 'verified'])
    const raw = JSON.stringify(b)
    for (const secret of [TRANSCRIPT_TEXT, 'mum@example.test', 'j1_secret', sha256(TOKEN), DOC, 'Diabetes']) expect(raw).not.toContain(secret)
    expect(b.verified).toEqual([{ id: 'f1', type: 'allergy', value: 'Penicillin', status: 'doctor_verified' }])
    expect(b.unverified).toEqual([{ id: 'f2', type: 'condition', value: 'Fainting', status: 'self_reported' }])
  })

  it('returns audio only when it matches the current facts', async () => {
    const { textHash } = await currentBriefing(PATIENT)
    testDb.seed('briefings', [
      { patient_id: PATIENT, language: 'en', text_hash: textHash, audio_url: 'https://s.test/en-new.mp3' },
      { patient_id: PATIENT, language: 'yo', text_hash: 'old-hash', audio_url: 'https://s.test/yo-old.mp3' },
      { patient_id: PATIENT, language: 'xx', text_hash: textHash, audio_url: 'https://s.test/bad.mp3' },
    ])
    const r = await invoke(emergency, { method: 'GET', url: `/api/emergency?id=${PATIENT}`, query: { id: PATIENT } })
    expect((r.body as { audio: unknown }).audio).toEqual({ en: 'https://s.test/en-new.mp3' })
  })

  it('answers 404 for an unknown or malformed id (the offline copy is then removed)', async () => {
    for (const id of ['56565656-5656-4565-8565-565656565656', 'not-a-uuid']) {
      const r = await invoke(emergency, { method: 'GET', url: `/api/emergency?id=${id}`, query: { id } })
      expect(r.status).toBe(404)
    }
  })
})

describe('/api/facts', () => {
  const get = (headers: Record<string, string> = {}) => invoke(facts, { method: 'GET', url: `/api/facts?patientId=${PATIENT}`, query: { patientId: PATIENT }, headers })
  const self = (body: Record<string, unknown>) => invoke(facts, { body: { action: 'self', patientId: PATIENT, token: TOKEN, ...body } })

  it('GET needs a signed-in doctor', async () => {
    expect((await get()).status).toBe(401)
    expect((await get({ authorization: 'Bearer forged.token.value' })).status).toBe(401)
  })

  it('GET returns only this patient\'s facts to a doctor', async () => {
    const r = await get({ authorization: `Bearer ${signDoctor(DOC)}` })
    expect(r.status).toBe(200)
    expect((r.body as { facts: { id: string }[] }).facts.map((f) => f.id).sort()).toEqual(['f1', 'f2'])
  })

  it('POST self needs the device token of this patient', async () => {
    expect((await self({ token: 'wrong', facts: [{ type: 'body_fact', value: 'Uses a wheelchair' }] })).status).toBe(403)
    expect((await self({ token: 'other-token', facts: [{ type: 'body_fact', value: 'Uses a wheelchair' }] })).status).toBe(403)
    expect((await self({ token: undefined, facts: [{ type: 'body_fact', value: 'Uses a wheelchair' }] })).status).toBe(403)
    expect(testDb.rows('facts')).toHaveLength(3)
    expect(ensure.calls).toEqual([])
  })

  it('POST self saves valid facts as self-reported only and refreshes the briefing', async () => {
    const r = await self({ facts: [
      { type: 'body_fact', value: 'Uses a wheelchair' },
      { type: 'allergy', value: 'Peanuts', status: 'doctor_verified' },
      { type: 'not-a-type', value: 'x' },
      { type: 'condition', value: '' },
    ] })
    expect(r.status).toBe(200)
    const added = testDb.rows('facts').filter((f) => f.patient_id === PATIENT && !['f1', 'f2'].includes(f.id as string))
    expect(added.map((f) => [f.type, f.value, f.status])).toEqual([['body_fact', 'Uses a wheelchair', 'self_reported'], ['allergy', 'Peanuts', 'self_reported']])
    expect(added.every((f) => !f.verified_by)).toBe(true)
    expect(ensure.calls).toEqual([PATIENT])
  })

  it('POST self caps the number and length of facts', async () => {
    await self({ facts: Array.from({ length: 30 }, (_, i) => ({ type: 'body_fact', value: `${i} ${'x'.repeat(200)}` })) })
    const added = testDb.rows('facts').filter((f) => f.patient_id === PATIENT && f.type === 'body_fact')
    expect(added).toHaveLength(20)
    expect(added.every((f) => (f.value as string).length <= 80)).toBe(true)
  })

  it('POST self for an unknown patient is 404', async () => {
    const r = await invoke(facts, { body: { action: 'self', patientId: '56565656-5656-4565-8565-565656565656', token: TOKEN, facts: [] } })
    expect(r.status).toBe(404)
  })
})
