import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './verify.js'
import { signDoctor } from './_lib/supabase.js'
import { testDb } from '../test/mocks/supabase.js'
import { invoke } from '../test/http.js'

// Paid YarnGPT work is replaced; the rest of the module is real
vi.mock('./_lib/briefing.js', async (load) => ({ ...(await load<typeof import('./_lib/briefing.js')>()), ensureBriefings: async () => ({ generated: [], reused: [] }) }))

const DOC = 'd0c70000-0000-4000-8000-000000000009'
const OTHER_DOC = 'd0c70000-0000-4000-8000-000000000010'
const PATIENT = '66666666-6666-4666-8666-666666666666'
const OTHER_PATIENT = '77777777-7777-4777-8777-777777777777'
const VISIT = '88888888-8888-4888-8888-888888888888'
const F_ASTHMA = 'aaaaaaaa-0000-4000-8000-000000000001'
const F_OLD = 'aaaaaaaa-0000-4000-8000-000000000002'
const F_FOREIGN = 'aaaaaaaa-0000-4000-8000-000000000003'
const F_BLOOD = 'aaaaaaaa-0000-4000-8000-000000000004'

const auth = (doc = DOC) => ({ authorization: `Bearer ${signDoctor(doc)}` })
const save = (body: Record<string, unknown>, doc = DOC) =>
  invoke(handler, { body: { patientId: PATIENT, visitId: VISIT, facts: [], transcript: [], summary: '', ...body }, headers: auth(doc) })
const facts = () => testDb.rows('facts').filter((f) => f.patient_id === PATIENT)
const TRANSCRIPT = [{ at: '2026-11-25T12:00:00Z', who: 'patient', kind: 'statement', text: 'My chest hurts' }]

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  testDb.seed('patients', [{ id: PATIENT, name: 'Ada', help_phone: '08012345678' }, { id: OTHER_PATIENT, name: 'Bola', help_phone: '08012345679' }])
  testDb.seed('facts', [
    { id: F_ASTHMA, patient_id: PATIENT, type: 'condition', value: 'Asthma', status: 'self_reported' },
    { id: F_OLD, patient_id: PATIENT, type: 'allergy', value: 'Old allergy', status: 'self_reported' },
    { id: F_FOREIGN, patient_id: OTHER_PATIENT, type: 'allergy', value: 'Latex', status: 'self_reported' },
  ])
})

describe('successful saves', () => {
  it('verifies, adds and removes facts and stores the visit once', async () => {
    const r = await save({
      facts: [{ id: F_ASTHMA, type: 'condition', value: ' Asthma ' }, { type: 'allergy', value: 'Penicillin' }, { type: 'blood_group', value: 'o +' }],
      remove: [F_OLD], transcript: TRANSCRIPT, summary: 'Patient: My chest hurts',
    })
    expect(r).toMatchObject({ status: 200, body: { ok: true } })
    const byValue = Object.fromEntries(facts().map((f) => [f.value, f]))
    expect(Object.keys(byValue).sort()).toEqual(['Asthma', 'O+', 'Penicillin'])
    expect(byValue.Asthma).toMatchObject({ id: F_ASTHMA, status: 'doctor_verified', verified_by: DOC })
    expect(byValue.Penicillin.status).toBe('doctor_verified')
    expect(testDb.rows('visits')).toEqual([expect.objectContaining({ id: VISIT, patient_id: PATIENT, doctor_id: DOC, transcript: TRANSCRIPT })])
  })

  it('saves a walk-in visit with no patient', async () => {
    const r = await save({ patientId: null, transcript: TRANSCRIPT })
    expect(r.status).toBe(200)
    expect(testDb.rows('visits')[0]).toMatchObject({ id: VISIT, patient_id: null })
  })

  it('still works for a client that sends no visit id', async () => {
    expect((await save({ visitId: undefined, facts: [{ type: 'medicine', value: 'Salbutamol' }] })).status).toBe(200)
    expect(testDb.rows('visits')).toHaveLength(1)
  })
})

describe('retries and duplicate submissions', () => {
  const body = { facts: [{ type: 'allergy', value: 'Penicillin' }, { id: F_ASTHMA, type: 'condition', value: 'Asthma' }], remove: [F_OLD], transcript: TRANSCRIPT }

  it('the same save sent twice creates no duplicate facts or visits', async () => {
    expect((await save(body)).status).toBe(200)
    expect((await save(body)).status).toBe(200)
    expect(facts().filter((f) => f.value === 'Penicillin')).toHaveLength(1)
    expect(testDb.rows('visits')).toHaveLength(1)
  })

  it('two parallel submissions store one visit', async () => {
    const rs = await Promise.all([save(body), save(body)])
    expect(rs.map((r) => r.status)).toEqual([200, 200])
    expect(testDb.rows('visits')).toHaveLength(1)
    expect(facts().filter((f) => f.value === 'Penicillin')).toHaveLength(1)
  })

  it('a new fact matching an existing one (any case) updates it instead of adding another', async () => {
    expect((await save({ facts: [{ type: 'condition', value: 'ASTHMA' }] })).status).toBe(200)
    expect(facts().filter((f) => f.type === 'condition')).toHaveLength(1)
    expect(facts().find((f) => f.id === F_ASTHMA)).toMatchObject({ value: 'ASTHMA', status: 'doctor_verified' })
  })

  it('a retry after the visit insert failed completes without duplicating facts', async () => {
    testDb.fail('visits', { op: 'insert' })
    const first = await save(body)
    expect(first.status).toBe(500)
    expect(first.body.error).not.toContain('simulated')
    const again = await save(body)
    expect(again.status).toBe(200)
    expect(facts().filter((f) => f.value === 'Penicillin')).toHaveLength(1)
    expect(facts().some((f) => f.id === F_OLD)).toBe(false)
    expect(testDb.rows('visits')).toHaveLength(1)
  })

  it('a visit id used by another doctor is refused', async () => {
    expect((await save({}, OTHER_DOC)).status).toBe(200)
    expect((await save({})).status).toBe(409)
  })
})

describe('database failures never report success', () => {
  it.each([
    ['facts lookup', 'facts', 'select'],
    ['fact update', 'facts', 'update'],
    ['fact insert', 'facts', 'insert'],
    ['fact delete', 'facts', 'delete'],
    ['visit lookup', 'visits', 'select'],
    ['visit insert', 'visits', 'insert'],
    ['patient lookup', 'patients', 'select'],
  ] as const)('%s fails -> 500 with a generic message', async (_label, table, op) => {
    testDb.fail(table, { op, message: 'secret detail' })
    const r = await save({ facts: [{ id: F_ASTHMA, type: 'condition', value: 'Asthma' }, { type: 'allergy', value: 'Penicillin' }], remove: [F_OLD] })
    expect(r.status).toBe(500)
    expect(r.body.ok).toBeUndefined()
    expect(JSON.stringify(r.body)).not.toContain('secret detail')
  })
})

describe('invalid medical facts are rejected before anything is written', () => {
  it.each([
    ['an unknown type', [{ type: 'diagnosis', value: 'Flu' }]],
    ['an empty value', [{ type: 'condition', value: '   ' }]],
    ['a non-string value', [{ type: 'condition', value: 42 }]],
    ['a value over 80 characters', [{ type: 'condition', value: 'x'.repeat(81) }]],
    ['control characters', [{ type: 'condition', value: 'Asthma\u0000' }]],
    ['an invalid blood group', [{ type: 'blood_group', value: 'C+' }]],
    ['two blood groups', [{ type: 'blood_group', value: 'O+' }, { type: 'blood_group', value: 'A+' }]],
    ['the same fact twice', [{ type: 'allergy', value: 'Latex' }, { type: 'allergy', value: 'latex' }]],
    ['a malformed fact id', [{ id: 'abc', type: 'condition', value: 'Asthma' }]],
    ['facts that are not a list', 'Asthma'],
    ['too many facts', Array.from({ length: 51 }, (_, i) => ({ type: 'condition', value: `C${i}` }))],
  ])('%s', async (_label, list) => {
    const before = testDb.rows('facts')
    const r = await save({ facts: list })
    expect(r.status).toBe(400)
    expect(testDb.rows('facts')).toEqual(before)
    expect(testDb.rows('visits')).toHaveLength(0)
  })

  it.each([
    ['a malformed body', '{"facts":'],
    ['a non-object body', '[1,2]'],
    ['a malformed visit id', { visitId: 'nope' }],
    ['a malformed remove list', { remove: ['not-a-uuid'] }],
    ['a fact kept and removed', { facts: [{ id: F_ASTHMA, type: 'condition', value: 'Asthma' }], remove: [F_ASTHMA] }],
    ['a bad transcript', { transcript: [{ who: 'nurse', text: 'hi' }] }],
    ['facts on a walk-in', { patientId: null, facts: [{ type: 'condition', value: 'Asthma' }] }],
  ])('rejects %s', async (_label, b) => {
    const r = typeof b === 'string' ? await invoke(handler, { body: b, headers: auth() }) : await save(b)
    expect(r.status).toBe(400)
  })

  it('needs a doctor session', async () => {
    expect((await invoke(handler, { body: { patientId: PATIENT, facts: [] } })).status).toBe(401)
  })
})

describe('consistent records', () => {
  it('another patient\'s fact can be neither updated nor removed', async () => {
    expect((await save({ facts: [{ id: F_FOREIGN, type: 'allergy', value: 'Hacked' }] })).status).toBe(200)
    expect((await save({ remove: [F_FOREIGN] })).status).toBe(200)
    expect(testDb.rows('facts').find((f) => f.id === F_FOREIGN)).toMatchObject({ patient_id: OTHER_PATIENT, value: 'Latex', status: 'self_reported' })
  })

  it('a second verified blood group is refused until the first is removed', async () => {
    testDb.seed('facts', [{ id: F_BLOOD, patient_id: PATIENT, type: 'blood_group', value: 'O+', status: 'doctor_verified' }])
    expect((await save({ facts: [{ type: 'blood_group', value: 'A+' }] })).status).toBe(409)
    expect((await save({ facts: [{ type: 'blood_group', value: 'A+' }], remove: [F_BLOOD] })).status).toBe(200)
    expect(facts().filter((f) => f.type === 'blood_group').map((f) => f.value)).toEqual(['A+'])
  })

  it('confirming the existing blood group again is fine', async () => {
    testDb.seed('facts', [{ id: F_BLOOD, patient_id: PATIENT, type: 'blood_group', value: 'O+', status: 'doctor_verified' }])
    expect((await save({ facts: [{ id: F_BLOOD, type: 'blood_group', value: 'O+' }] })).status).toBe(200)
  })
})
