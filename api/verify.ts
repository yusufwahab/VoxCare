import { waitUntil } from '@vercel/functions'
import { route, body } from './_lib/http.js'
import { db, dbFailed, isUuid, loadPatient, requireDoctor, resolveId } from './_lib/supabase.js'
import { ensureBriefings } from './_lib/briefing.js'
import { HttpError, safeMessage } from './_lib/env.js'

export const FACT_TYPES = ['condition', 'allergy', 'medicine', 'blood_group', 'event_history', 'body_fact'] as const
type FactType = (typeof FACT_TYPES)[number]
export const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
export const MAX_VALUE = 80
const MAX_FACTS = 50
const MAX_TRANSCRIPT = 500
const MAX_TRANSCRIPT_TEXT = 1000

interface Fact { id?: string; type: FactType; value: string }
interface Existing { id: string; type: string; value: string; status: string }

const bad = (msg: string) => new HttpError(400, msg)

/**
 * Saves for one patient run one after another in this process, so two parallel submissions cannot both
 * insert the same new fact. Single instance only (like the rate limits); the database has no unique index.
 */
const queues = new Map<string, Promise<unknown>>()
async function oneAtATime<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const before = queues.get(id) ?? Promise.resolve()
  const run = before.then(fn, fn)
  const tail = run.catch(() => {})
  queues.set(id, tail)
  try { return await run } finally { if (queues.get(id) === tail) queues.delete(id) }
}
const key = (type: string, value: string) => `${type}:${value.toLowerCase()}`

/** A clean fact value, or a 400. Values are never silently cut. */
function cleanValue(type: FactType, raw: unknown): string {
  if (typeof raw !== 'string') throw bad('Each fact needs a value')
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) throw bad('A fact contains characters that are not allowed')
  const value = raw.replace(/\s+/g, ' ').trim()
  if (!value) throw bad('A fact is empty')
  if (value.length > MAX_VALUE) throw bad(`A fact is longer than ${MAX_VALUE} characters`)
  if (type === 'blood_group') {
    const g = value.replace(/\s/g, '').toUpperCase()
    if (!BLOOD_GROUPS.includes(g)) throw bad('Blood group must be one of O+, O-, A+, A-, B+, B-, AB+, AB-')
    return g
  }
  return value
}

export interface VerifyInput { patientId: string | null; visitId: string | null; facts: Fact[]; remove: string[]; transcript: unknown[]; summary: string }

/** Checks the whole request before anything is written. */
export function parseVerify(b: unknown): VerifyInput {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Invalid request')
  const o = b as Record<string, unknown>
  const patientId = o.patientId ?? null
  if (patientId !== null && typeof patientId !== 'string') throw bad('Invalid patient')
  const visitId = o.visitId ?? null
  if (visitId !== null && (typeof visitId !== 'string' || !isUuid(visitId))) throw bad('Invalid visit id')

  const rawFacts = o.facts ?? []
  if (!Array.isArray(rawFacts) || rawFacts.length > MAX_FACTS) throw bad('Invalid facts')
  if (!patientId && rawFacts.length) throw bad('A walk-in visit has no facts')
  const seen = new Set<string>()
  const facts: Fact[] = rawFacts.map((f) => {
    if (!f || typeof f !== 'object') throw bad('Invalid facts')
    const { id, type, value } = f as Record<string, unknown>
    if (typeof type !== 'string' || !(FACT_TYPES as readonly string[]).includes(type)) throw bad('Unknown fact type')
    if (id !== undefined && id !== null && (typeof id !== 'string' || !isUuid(id))) throw bad('Invalid fact id')
    const clean = cleanValue(type as FactType, value)
    if (seen.has(key(type, clean))) throw bad('The same fact is listed twice')
    seen.add(key(type, clean))
    return { id: (id as string | null | undefined) ?? undefined, type: type as FactType, value: clean }
  })
  if (facts.filter((f) => f.type === 'blood_group').length > 1) throw bad('A patient has only one blood group')

  const remove = o.remove ?? []
  if (!Array.isArray(remove) || remove.length > MAX_FACTS || !remove.every((id) => typeof id === 'string' && isUuid(id))) throw bad('Invalid facts to remove')
  if (facts.some((f) => f.id && remove.includes(f.id))) throw bad('A fact cannot be kept and removed')

  const transcript = o.transcript ?? []
  if (!Array.isArray(transcript) || transcript.length > MAX_TRANSCRIPT) throw bad('Invalid transcript')
  for (const t of transcript) {
    const item = t as Record<string, unknown> | null
    if (!item || typeof item !== 'object' || (item.who !== 'patient' && item.who !== 'doctor') || typeof item.text !== 'string' || item.text.length > MAX_TRANSCRIPT_TEXT) throw bad('Invalid transcript')
  }
  const summary = o.summary ?? ''
  if (typeof summary !== 'string') throw bad('Invalid summary')
  return { patientId, visitId, facts, remove: remove as string[], transcript, summary: summary.slice(0, 4000) }
}

/**
 * Doctor only. Saves facts as doctor_verified, stores the visit, regenerates the briefing.
 *
 * Not one transaction (that needs a Postgres function: see .agent/decisions.md). Instead every step can be
 * repeated safely, so a retry after a partial failure ends in the same records, never duplicates:
 *  - a fact is matched by id, else by type + value (case-insensitive), and updated instead of inserted again;
 *  - removing an already removed fact does nothing;
 *  - the visit uses the id the client sent, so it is stored once.
 * Any failed write returns 500 and the client keeps the form to retry. Success is only returned after all writes.
 */
export default route(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
  const doctorId = requireDoctor(req.headers.authorization)
  const input = parseVerify(body<unknown>(req))
  const now = new Date().toISOString()

  const lockId = input.patientId ? resolveId(input.patientId) : `walk-in:${input.visitId ?? now}`
  return oneAtATime(lockId, () => saveVisit(doctorId, input, now))
})

async function saveVisit(doctorId: string, input: VerifyInput, now: string) {
  let patientDbId: string | null = null
  if (input.patientId) {
    const p = await loadPatient(input.patientId)
    patientDbId = p.id
    const { data, error } = await db().from('facts').select('id,type,value,status').eq('patient_id', p.id)
    if (error) dbFailed('verify facts lookup', error)
    const existing = (data ?? []) as Existing[]
    const byId = new Map(existing.map((f) => [f.id, f]))
    const byValue = new Map(existing.map((f) => [key(f.type, f.value), f]))
    const removing = new Set(input.remove)

    // A second, different verified blood group would make the emergency briefing contradict itself
    const blood = input.facts.find((f) => f.type === 'blood_group')
    if (blood) {
      const target = (blood.id && byId.get(blood.id)) || byValue.get(key(blood.type, blood.value))
      const clash = existing.some((f) => f.type === 'blood_group' && f.status === 'doctor_verified' && f.id !== target?.id && !removing.has(f.id))
      if (clash) throw new HttpError(409, 'This patient already has a verified blood group. Remove it first.')
    }

    const row = (f: Fact) => ({ patient_id: p.id, type: f.type, value: f.value, status: 'doctor_verified', verified_by: doctorId, verified_at: now })
    const inserts: ReturnType<typeof row>[] = []
    const claimed = new Set<string>()
    for (const f of input.facts) {
      const target = (f.id && byId.get(f.id)) || byValue.get(key(f.type, f.value))
      // Two facts edited into the same text: keep one
      if (target && claimed.has(target.id)) continue
      if (target) {
        claimed.add(target.id)
        const { error: e } = await db().from('facts').update(row(f)).eq('id', target.id).eq('patient_id', p.id)
        if (e) dbFailed('verify fact update', e)
      } else inserts.push(row(f))
    }
    if (inserts.length) {
      const { error: e } = await db().from('facts').insert(inserts)
      if (e) dbFailed('verify fact insert', e)
    }
    // Only this patient's facts, and never one that was just confirmed
    const toRemove = input.remove.filter((id) => byId.has(id) && !claimed.has(id))
    if (toRemove.length) {
      const { error: e } = await db().from('facts').delete().eq('patient_id', p.id).in('id', toRemove)
      if (e) dbFailed('verify fact delete', e)
    }
  }

  // The visit is stored once per visit id, even if the request is retried
  const visitId = input.visitId
  let stored = false
  if (visitId) {
    const { data, error } = await db().from('visits').select('id,doctor_id').eq('id', visitId).maybeSingle()
    if (error) dbFailed('visit lookup', error)
    if (data && (data as { doctor_id: string }).doctor_id !== doctorId) throw new HttpError(409, 'Invalid visit id')
    stored = !!data
  }
  if (!stored) {
    const { error } = await db().from('visits').insert({ ...(visitId ? { id: visitId } : {}), patient_id: patientDbId, doctor_id: doctorId, started_at: now, ended_at: now, transcript: input.transcript, summary: input.summary })
    // 23505: a parallel retry stored it first
    if (error && error.code !== '23505') dbFailed('visit insert', error)
  }

  if (patientDbId) waitUntil(ensureBriefings(patientDbId).catch((e) => console.error('[briefing] background failed', safeMessage(e))))
  return { ok: true }
}
