import { waitUntil } from '@vercel/functions'
import { route, body } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db, loadPatient, requireDoctor } from './_lib/supabase.js'
import { ensureBriefings } from './_lib/briefing.js'

interface VerifyBody {
  visitId: string
  patientId: string | null
  facts: { id?: string; type: string; value: string }[]
  remove?: string[]
  summary: string
}

/** Doctor only. Saves facts as doctor_verified (service role), closes the visit, regenerates the briefing. */
export default route(async (req) => {
  const doctorId = requireDoctor(req.headers.authorization)
  const b = body<VerifyBody>(req)
  const now = new Date().toISOString()
  if (!b.visitId) throw new HttpError(400, 'Missing visit')

  let patientDbId: string | null = null
  if (b.patientId) {
    const p = await loadPatient(b.patientId)
    patientDbId = p.id
    if (b.remove?.length) await db().from('facts').delete().eq('patient_id', p.id).in('id', b.remove)
    for (const f of b.facts) {
      const row = { patient_id: p.id, type: f.type, value: f.value.slice(0, 80), status: 'doctor_verified', verified_by: doctorId, verified_at: now }
      if (f.id) {
        const { data } = await db().from('facts').update(row).eq('id', f.id).eq('patient_id', p.id).select('id')
        if (data?.length) continue
      }
      await db().from('facts').insert(row)
    }
  }

  const { error } = await db().from('visits').update({ ended_at: now, status: 'ended', summary: (b.summary ?? '').slice(0, 4000) }).eq('id', b.visitId).eq('doctor_id', doctorId)
  if (error) throw new HttpError(500, error.message)

  if (patientDbId) waitUntil(ensureBriefings(patientDbId).catch((e) => console.error('[briefing] background failed', e.message)))
  return { ok: true }
})
