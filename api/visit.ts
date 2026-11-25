import { randomInt } from 'node:crypto'
import { route, body, q } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db, loadPatient, requireDoctor } from './_lib/supabase.js'
import { limit } from './_lib/limit.js'

const MAX_AGE_MS = 12 * 3600_000

interface VisitRow {
  id: string
  code: string | null
  mode: 'one' | 'two'
  status: 'active' | 'ended'
  started_at: string
  transcript: unknown[]
  doctor: { name: string; mdcn_number: string; verified: boolean } | null
  patient: { name: string | null; photo_url: string | null } | null
}

const SELECT = 'id,code,mode,status,started_at,transcript,doctor:doctors(name,mdcn_number,verified),patient:patients(name,photo_url)'

const fresh = (r: VisitRow) => r.status === 'active' && Date.now() - new Date(r.started_at).getTime() < MAX_AGE_MS

export default route(async (req) => {
  if (req.method === 'GET') {
    const id = q(req, 'id')
    const code = q(req, 'code')
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6 digits')
    limit(req, 'visit-code', 30)

    // Patient typed the code: find the visit. Returns who is calling, never the conversation.
    if (!id) {
      const { data } = await db().from('visits').select(SELECT).eq('code', code).eq('status', 'active').order('started_at', { ascending: false }).limit(1).maybeSingle()
      const r = data as unknown as VisitRow | null
      if (!r || !fresh(r)) throw new HttpError(404, 'This code was not found')
      return { id: r.id, mode: r.mode, doctor: r.doctor, patient: r.patient }
    }

    // A device with the id and the code gets the whole visit, to replay it
    const { data } = await db().from('visits').select(SELECT).eq('id', id).maybeSingle()
    const r = data as unknown as VisitRow | null
    if (!r || r.code !== code) throw new HttpError(404, 'This visit was not found')
    return { id: r.id, mode: r.mode, status: r.status, doctor: r.doctor, patient: r.patient, transcript: r.transcript }
  }

  // POST: a signed-in doctor starts a visit
  const doctorId = requireDoctor(req.headers.authorization)
  const b = body<{ patientId?: string | null; mode?: 'one' | 'two' }>(req)
  const patientId = b.patientId ? (await loadPatient(b.patientId)).id : null

  for (let i = 0; i < 8; i++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const { data: clash } = await db().from('visits').select('id').eq('code', code).eq('status', 'active').limit(1)
    if (clash?.length) continue
    const { data, error } = await db().from('visits').insert({ patient_id: patientId, doctor_id: doctorId, mode: b.mode === 'two' ? 'two' : 'one', code, status: 'active', transcript: [] }).select('id').single()
    if (error) throw new HttpError(500, error.message)
    return { id: data.id, code }
  }
  throw new HttpError(500, 'Could not make a visit code')
})
