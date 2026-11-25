import { route, body } from './_lib/http.js'
import { db, sha256, signDoctor } from './_lib/supabase.js'

/** POST { pin } -> { doctor, token } if a verified doctor has this PIN. */
export default route(async (req) => {
  const { pin } = body<{ pin: string }>(req)
  if (!/^\d{4}$/.test(pin ?? '')) return { doctor: null }
  const { data } = await db().from('doctors').select('id,name,mdcn_number,verified').eq('verified', true).eq('pin', sha256(`voxcare:${pin}`)).maybeSingle()
  if (!data) return { doctor: null }
  return { doctor: data, token: signDoctor(data.id) }
})
