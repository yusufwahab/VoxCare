import { route, body } from './_lib/http.js'
import { ensureBriefings } from './_lib/briefing.js'

/** POST { patientId } -> makes sure the 4 language briefings exist for the current facts (cached). */
export default route(async (req) => {
  const { patientId } = body<{ patientId: string }>(req)
  return ensureBriefings(patientId)
})
