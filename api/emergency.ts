import { route, q } from './_lib/http.js'
import { currentBriefing, LANG_IDS, type Lang } from './_lib/briefing.js'
import { db } from './_lib/supabase.js'

/**
 * GET ?id= -> ONLY the briefing subset: photo, name, verified facts, unverified facts, help phone, audio URLs.
 * Never returns visit transcripts. Audio is only returned if it matches the current facts.
 */
export default route(async (req) => {
  const { patient, verified, unverified, text, textHash } = await currentBriefing(q(req, 'id'))
  const { data: rows } = await db().from('briefings').select('language,audio_url,text_hash').eq('patient_id', patient.id)
  const audio: Partial<Record<Lang, string>> = {}
  for (const r of rows ?? []) {
    if (r.text_hash === textHash && LANG_IDS.includes(r.language)) audio[r.language as Lang] = r.audio_url
  }
  const pick = (f: { id?: string; type: string; value: string; status: string }, i: number) => ({ id: f.id ?? String(i), type: f.type, value: f.value, status: f.status })
  return {
    id: patient.id,
    name: patient.name,
    photo_url: patient.photo_url,
    help_phone: patient.help_phone,
    help_name: patient.help_name,
    verified: verified.map(pick),
    unverified: unverified.map(pick),
    audio,
    text,
  }
})
