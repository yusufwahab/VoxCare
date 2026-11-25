import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureBriefings, timing } from './_lib/briefing.js'
import { testDb } from '../test/mocks/supabase.js'
import { json, mockFetch } from '../test/mocks/fetch.js'

const PATIENT = 'abababab-abab-4bab-8bab-abababababab'
const YARN = 'https://api.yarngpt.ai/api/v1'

let tts: number
beforeEach(() => {
  timing.pollMs = 1
  tts = 0
  vi.spyOn(console, 'log').mockImplementation(() => {})
  testDb.seed('patients', [{ id: PATIENT, name: 'Ada', help_phone: '08012345678' }])
  testDb.seed('facts', [{ patient_id: PATIENT, type: 'allergy', value: 'Penicillin', status: 'doctor_verified', verified_at: '2026-11-25T10:00:00Z' }])
  mockFetch([
    [`${YARN}/voices`, () => json([{ voice: 'idera' }, { voice: 'adaora' }, { voice: 'zainab' }])],
    [`${YARN}/tts`, () => { tts++; return json({ job_id: `job${tts}` }, 202) }],
    [`${YARN}/status/`, () => json({ status: 'completed', audio_url: 'https://audio.yarngpt.test/file.mp3' })],
    ['https://audio.yarngpt.test/', () => new Response(new Uint8Array([1, 2, 3]))],
  ])
})

describe('briefing generation', () => {
  it('makes the four language briefings once', async () => {
    const r = await ensureBriefings(PATIENT)
    expect(r.generated.sort()).toEqual(['en', 'ha', 'ig', 'yo'])
    expect(tts).toBe(4)
    expect(testDb.rows('briefings')).toHaveLength(4)
  })

  it('two requests at the same time do not pay YarnGPT twice', async () => {
    const [a, b] = await Promise.all([ensureBriefings(PATIENT), ensureBriefings('abababab-abab-4bab-8bab-abababababab')])
    expect(tts).toBe(4)
    expect(a).toBe(b)
    expect(testDb.rows('briefings')).toHaveLength(4)
  })

  it('facts saved during a run are still included afterwards (legitimate regeneration)', async () => {
    const first = ensureBriefings(PATIENT)
    await vi.waitFor(() => expect(tts).toBeGreaterThan(0))
    // A doctor verifies a new fact while the first run is in progress
    testDb.seed('facts', [{ patient_id: PATIENT, type: 'blood_group', value: 'O+', status: 'doctor_verified', verified_at: '2026-11-25T11:00:00Z' }])
    const second = ensureBriefings(PATIENT)
    await Promise.all([first, second])
    // 4 for the old text, 4 for the new text; nothing duplicated
    expect(tts).toBe(8)
    const hashes = new Set(testDb.rows('briefings').map((r) => r.text_hash))
    expect(hashes.size).toBe(1)
  })

  it('a later request with unchanged facts reuses the audio', async () => {
    await ensureBriefings(PATIENT)
    const r = await ensureBriefings(PATIENT)
    expect(r.reused.sort()).toEqual(['en', 'ha', 'ig', 'yo'])
    expect(tts).toBe(4)
  })
})
