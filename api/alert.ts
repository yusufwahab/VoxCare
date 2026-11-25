import { route, body, baseUrl } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db, isUuid, loadPatient, resolveId } from './_lib/supabase.js'
import { sendAlertEmail } from './_lib/email.js'
import { clientKey } from './_lib/clientIp.js'
import { limiters } from './_lib/limits.js'
import { enforce } from './_lib/rateLimit.js'

const WINDOW_MS = 10 * 60_000

/**
 * POST { patientId, lat?, lng? } -> emails the help person. At most one alert per patient every 10 minutes.
 * Opening the emergency page (GET /api/emergency) is not limited; only this notification is.
 */
export default route(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
  const { patientId, lat, lng } = body<{ patientId?: unknown; lat?: number; lng?: number }>(req)
  if (typeof patientId !== 'string' || !isUuid(resolveId(patientId))) throw new HttpError(404, 'Not found')
  const id = resolveId(patientId)

  // Both counts are taken before any await, so parallel requests cannot send two emails
  const { key, source } = clientKey(req)
  enforce(limiters.alertClient, key, 'alert', source)
  if (!limiters.alertPatient.take(id).ok) return { sent: true, reason: 'rate_limited' }

  try {
    const patient = await loadPatient(patientId)
    if (!patient.help_email) {
      limiters.alertPatient.release(id)
      return { sent: false, reason: 'no_email' }
    }

    // Also checked in the database, which survives restarts
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

    // sent_at from the same clock as the 10-minute check above
    await db().from('alerts').insert({ patient_id: patient.id, sent_at: new Date().toISOString(), lat: hasLoc ? lat : null, lng: hasLoc ? lng : null })
    // The patient id is the emergency link, so it is never logged
    console.log('[alert] emailed')
    return { sent: true }
  } catch (e) {
    // Not sent: let the next attempt try again
    limiters.alertPatient.release(id)
    throw e
  }
})
