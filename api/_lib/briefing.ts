import { env, HttpError } from './env.js'
import { db, dbFailed, loadPatient, sha256 } from './supabase.js'
import { briefingText, type FactRow } from './briefingText.js'
import { fetchWithTimeout, TIMEOUTS } from './fetchTimeout.js'

export type Lang = 'en' | 'yo' | 'ig' | 'ha'
export const LANG_IDS: Lang[] = ['en', 'yo', 'ig', 'ha']

const YARN = 'https://api.yarngpt.ai/api/v1'

/**
 * One voice per language, chosen once from GET /voices and kept in memory.
 * VOICE_PREFERENCES lists names to look for first; if none match, the first voice is used.
 * (Confirm the final choices with the real key; see README.)
 */
const VOICE_PREFERENCES: Record<Lang, string[]> = {
  en: ['idera', 'emma'],
  yo: ['adaora', 'idera'],
  ig: ['adaora', 'mary'],
  ha: ['zainab', 'umar'],
}
let voiceCache: Record<Lang, string> | null = null

interface VoiceInfo { id?: string; name?: string; voice?: string; languages?: string[] }

async function pickVoices(): Promise<Record<Lang, string>> {
  if (voiceCache) return voiceCache
  const res = await fetchWithTimeout('YarnGPT', `${YARN}/voices`, { headers: { Authorization: `Bearer ${env('YARNGPT_API_KEY')}` } }, TIMEOUTS.yarnApi)
  if (!res.ok) throw new HttpError(502, `YarnGPT voices error ${res.status}`)
  const json = (await res.json()) as VoiceInfo[] | { voices?: VoiceInfo[]; data?: VoiceInfo[] }
  const list: VoiceInfo[] = Array.isArray(json) ? json : (json.voices ?? json.data ?? [])
  const nameOf = (v: VoiceInfo) => v.voice ?? v.name ?? v.id ?? ''
  const names = list.map(nameOf).filter(Boolean)
  if (!names.length) throw new HttpError(502, 'YarnGPT returned no voices')
  const pick = (lang: Lang) => {
    for (const p of VOICE_PREFERENCES[lang]) {
      const hit = names.find((n) => n.toLowerCase() === p)
      if (hit) return hit
    }
    return names[0]
  }
  const chosen = { en: pick('en'), yo: pick('yo'), ig: pick('ig'), ha: pick('ha') }
  console.log('[briefing] voices chosen', chosen, 'of', names.length)
  voiceCache = chosen
  return chosen
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function synthesise(text: string, lang: Lang, voice: string, cacheKey: string): Promise<Buffer> {
  const headers = {
    Authorization: `Bearer ${env('YARNGPT_API_KEY')}`,
    'Idempotency-Key': cacheKey,
    'Content-Type': 'application/json',
  }
  const payload: Record<string, unknown> = { text, voice, output_format: 'mp3' }
  if (lang !== 'en') payload.target_language = lang
  console.log('[briefing] YarnGPT call', lang, voice, cacheKey.slice(0, 10))
  const start = await fetchWithTimeout('YarnGPT', `${YARN}/tts`, { method: 'POST', headers, body: JSON.stringify(payload) }, TIMEOUTS.yarnApi)
  if (start.status !== 202 && !start.ok) throw new HttpError(502, `YarnGPT tts error ${start.status}`)
  const { job_id } = (await start.json()) as { job_id: string }

  for (let i = 0; i < 40; i++) {
    await sleep(1500)
    let st: Response
    try {
      st = await fetchWithTimeout('YarnGPT', `${YARN}/status/${job_id}`, { headers: { Authorization: headers.Authorization } }, TIMEOUTS.yarnApi)
    } catch {
      continue // a slow or failed status check is retried; the loop bounds the total
    }
    if (!st.ok) continue
    const s = (await st.json()) as { status: string; audio_url?: string }
    if (s.status === 'failed') throw new HttpError(502, 'YarnGPT job failed')
    if (s.status === 'completed' && s.audio_url) {
      // The URL expires in about an hour, so download immediately
      const audio = await fetchWithTimeout('YarnGPT audio', s.audio_url, {}, TIMEOUTS.yarnAudio)
      if (!audio.ok) throw new HttpError(502, 'Could not download audio')
      return Buffer.from(await audio.arrayBuffer())
    }
  }
  throw new HttpError(504, 'YarnGPT timed out')
}

export async function currentBriefing(rawPatientId: string) {
  const patient = await loadPatient(rawPatientId)
  const { data } = await db().from('facts').select('id,type,value,status').eq('patient_id', patient.id).order('verified_at', { ascending: true })
  const facts = (data ?? []) as FactRow[]
  const verified = facts.filter((f) => f.status === 'doctor_verified')
  const unverified = facts.filter((f) => f.status !== 'doctor_verified')
  const text = briefingText(patient.name, verified, unverified)
  return { patient, verified, unverified, text, textHash: sha256(text) }
}

/** Make sure all four briefings exist for the current text. Reuses anything already generated. */
export async function ensureBriefings(rawPatientId: string): Promise<{ generated: Lang[]; reused: Lang[] }> {
  const { patient, text, textHash } = await currentBriefing(rawPatientId)
  const voices = await pickVoices()
  const generated: Lang[] = []
  const reused: Lang[] = []

  await Promise.all(
    LANG_IDS.map(async (lang) => {
      const voice = voices[lang]
      const cacheKey = sha256(text + lang + voice)
      const path = `${cacheKey}.mp3`
      const publicUrl = db().storage.from('briefings').getPublicUrl(path).data.publicUrl

      // 1. Is it already in the table (for any patient, same text)?
      const { data: row } = await db().from('briefings').select('audio_url').eq('language', lang).eq('text_hash', textHash).eq('audio_url', publicUrl).limit(1).maybeSingle()
      // 2. or already in storage?
      let exists = !!row
      if (!exists) {
        const { data: files } = await db().storage.from('briefings').list('', { search: path, limit: 1 })
        exists = !!files?.some((f) => f.name === path)
      }
      if (!exists) {
        const mp3 = await synthesise(text, lang, voice, cacheKey)
        const { error } = await db().storage.from('briefings').upload(path, mp3, { contentType: 'audio/mpeg', upsert: true })
        if (error) dbFailed('briefing audio upload', error as { code?: string })
        generated.push(lang)
      } else reused.push(lang)

      await db().from('briefings').upsert(
        { patient_id: patient.id, language: lang, text_hash: textHash, audio_url: publicUrl, created_at: new Date().toISOString() },
        { onConflict: 'patient_id,language' },
      )
    }),
  )
  console.log('[briefing] done', { generated, reused })
  return { generated, reused }
}
