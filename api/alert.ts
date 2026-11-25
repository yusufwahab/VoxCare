import { route, body, baseUrl } from './_lib/http.js'
import { db, loadPatient } from './_lib/supabase.js'
import { sendAlertEmail } from './_lib/email.js'

const WINDOW_MS = 10 * 60_000

/** POST { patientId, lat?, lng? } -> emails the help person. At most one alert per patient every 10 minutes. */
export default route(async (req) => {
  const { patientId, lat, lng } = body<{ patientId: string; lat?: number; lng?: number }>(req)
  const patient = await loadPatient(patientId)
  if (!patient.help_email) return { sent: false, reason: 'no_email' }

  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data: recent } = await db().from('alerts').select('sent_at').eq('patient_id', patient.id).gte('sent_at', since).limit(1)
  if (recent && recent.length) return { sent: true, reason: 'rate_limited' }

  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng)
  await sendAlertEmail({
    to: patient.help_email,
    patientName: patient.name,
    photoUrl: patient.photo_url,
    helpName: patient.help_name,
    lat: hasLoc ? lat : undefined,
    lng: hasLoc ? lng : undefined,
    emergencyUrl: `${baseUrl(req)}/e/${patientId}`,
  })

  await db().from('alerts').insert({ patient_id: patient.id, lat: hasLoc ? lat : null, lng: hasLoc ? lng : null })
  console.log('[alert] emailed for', patient.id)
  return { sent: true }
})
