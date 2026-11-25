import { waitUntil } from '@vercel/functions'
import { route, body } from './_lib/http.js'
import { db, loadPatient, requireDoctor } from './_lib/supabase.js'
import { ensureBriefings } from './_lib/briefing.js'
import { safeMessage } from './_lib/env.js'

interface VerifyBody {
  patientId: string | null
  doctorId: string
  facts: { id?: string; type: string; value: string }[]
  remove?: string[]
  transcript: unknown[]
  summary: string
}

/** Doctor only. Saves facts as doctor_verified (service role), stores the visit, regenerates the briefing. */
export default route(async (req) => {
  const doctorId = requireDoctor(req.headers.authorization)
  const b = body<VerifyBody>(req)
  const now = new Date().toISOString()

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

  await db().from('visits').insert({ patient_id: patientDbId, doctor_id: doctorId, started_at: now, ended_at: now, transcript: b.transcript ?? [], summary: (b.summary ?? '').slice(0, 4000) })

  if (patientDbId) waitUntil(ensureBriefings(patientDbId).catch((e) => console.error('[briefing] background failed', safeMessage(e))))
  return { ok: true }
})
