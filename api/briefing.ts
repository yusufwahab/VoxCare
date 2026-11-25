import { route, body } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { ensureBriefings } from './_lib/briefing.js'
import { clientKey } from './_lib/clientIp.js'
import { limiters } from './_lib/limits.js'
import { enforce } from './_lib/rateLimit.js'

/** POST { patientId } -> makes sure the 4 language briefings exist for the current facts (cached). */
export default route(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
  const { patientId } = body<{ patientId?: unknown }>(req)
  if (typeof patientId !== 'string' || !patientId) throw new HttpError(400, 'Invalid request')
  const { key, source } = clientKey(req)
  enforce(limiters.briefing, key, 'briefing', source)
  return ensureBriefings(patientId)
})
