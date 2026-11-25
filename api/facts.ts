import { route, body, q } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db, loadPatient, requireDoctor, sha256 } from './_lib/supabase.js'

const TYPES = ['condition', 'allergy', 'medicine', 'blood_group', 'event_history', 'body_fact']

export default route(async (req) => {
  // GET ?patientId= (doctor only): all facts, for the verify screen
  if (req.method === 'GET') {
    requireDoctor(req.headers.authorization)
    const p = await loadPatient(q(req, 'patientId'))
    const { data } = await db().from('facts').select('id,type,value,status,verified_by,verified_at').eq('patient_id', p.id)
    return { facts: data ?? [] }
  }

  // POST { action: 'self', patientId, token, facts } -> the patient adds self-reported facts to their own card
  const b = body<{ patientId: string; token: string; facts: { type: string; value: string }[] }>(req)
  const p = await loadPatient(b.patientId)
  if (!b.token || sha256(b.token) !== p.token_hash) throw new HttpError(403, 'Not allowed')
  const rows = (b.facts ?? [])
    .filter((f) => TYPES.includes(f.type) && f.value)
    .slice(0, 20)
    .map((f) => ({ patient_id: p.id, type: f.type, value: f.value.slice(0, 80), status: 'self_reported' }))
  if (rows.length) await db().from('facts').insert(rows)
  return { ok: true }
})
