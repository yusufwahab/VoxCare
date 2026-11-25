import type { VercelRequest } from '@vercel/node'
import { route, body, baseUrl } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db, isUuid, loadPatient, resolveId } from './_lib/supabase.js'
import { sendAlertEmail } from './_lib/email.js'
import { clientKey } from './_lib/clientIp.js'
import { limiters } from './_lib/limits.js'
import { enforce } from './_lib/rateLimit.js'

const WINDOW_MS = 10 * 60_000

type AlertResult = { sent: boolean; reason?: string }

/** Alerts being sent right now, per patient. A parallel request waits for the same outcome. */
const inflight = new Map<string, Promise<AlertResult>>()

/** A usable location, or none. A bad location never blocks the alert. */
export function cleanLocation(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

async function send(req: VercelRequest, patientId: string, loc: { lat: number; lng: number } | null): Promise<AlertResult> {
  const patient = await loadPatient(patientId)
  if (!patient.help_email) return { sent: false, reason: 'no_email' }

  // Also checked in the database, which survives restarts. A row exists only for an email that was sent.
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data: recent } = await db().from('alerts').select('sent_at').eq('patient_id', patient.id).gte('sent_at', since).limit(1)
  if (recent && recent.length) return { sent: true, reason: 'rate_limited' }

  await sendAlertEmail({
    to: patient.help_email,
    patientName: patient.name,
    photoUrl: patient.photo_url,
    helpName: patient.help_name,
    lat: loc?.lat,
    lng: loc?.lng,
    emergencyUrl: `${baseUrl(req)}/e/${patientId}`,
  })

  // sent_at from the same clock as the 10-minute check above
  await db().from('alerts').insert({ patient_id: patient.id, sent_at: new Date().toISOString(), lat: loc?.lat ?? null, lng: loc?.lng ?? null })
  // The patient id is the emergency link, so it is never logged
  console.log('[alert] emailed')
  return { sent: true }
}

/**
 * POST { patientId, lat?, lng? } -> emails the help person. At most one alert per patient every 10 minutes.
 * Opening the emergency page (GET /api/emergency) is not limited; only this notification is.
 * `sent: true` only means an email really went out (now, or within the last 10 minutes).
 */
export default route(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
  const { patientId, lat, lng } = body<{ patientId?: unknown; lat?: unknown; lng?: unknown }>(req)
  if (typeof patientId !== 'string' || !isUuid(resolveId(patientId))) throw new HttpError(404, 'Not found')
  const id = resolveId(patientId)

  // Everything below up to inflight.set runs before any await, so parallel requests cannot send two emails
  const { key, source } = clientKey(req)
  enforce(limiters.alertClient, key, 'alert', source)
  const pending = inflight.get(id)
  if (pending) return pending
  // Taken only while no alert is in flight, and given back if one fails: a hit means one was really sent
  if (!limiters.alertPatient.take(id).ok) return { sent: true, reason: 'rate_limited' }

  const job = send(req, patientId, cleanLocation(lat, lng)).then(
    (r) => {
      if (!r.sent) limiters.alertPatient.release(id)
      return r
    },
    (e: unknown) => {
      // Not sent: let the next attempt try again
      limiters.alertPatient.release(id)
      throw e
    },
  )
  inflight.set(id, job)
  try {
    return await job
  } finally {
    inflight.delete(id)
  }
})
