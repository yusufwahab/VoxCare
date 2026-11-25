import { randomUUID } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { route, body, q } from './_lib/http.js'
import { HttpError, safeMessage } from './_lib/env.js'
import { db, dbFailed, loadPatient, newToken, sha256 } from './_lib/supabase.js'
import { ensureBriefings } from './_lib/briefing.js'
import { newJoinToken } from './_lib/invite.js'

interface NewPatient { name?: string | null; photo?: string | null; help_phone: string; help_name?: string | null }

async function uploadPhoto(dataUrl: string): Promise<string | null> {
  const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/)
  if (!m) return null
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 1_500_000) throw new HttpError(413, 'Photo is too large')
  const path = `${randomUUID()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`
  const { error } = await db().storage.from('photos').upload(path, buf, { contentType: `image/${m[1]}` })
  if (error) dbFailed('photo upload', error as { code?: string })
  return db().storage.from('photos').getPublicUrl(path).data.publicUrl
}

export default route(async (req) => {
  // GET ?id= -> minimal public info for the doctor's "Allow" screen
  if (req.method === 'GET') {
    try {
      const p = await loadPatient(q(req, 'id'))
      return { id: p.id, name: p.name, photo_url: p.photo_url }
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null
      throw e
    }
  }

  // POST -> create the patient. Returns the id and a secret token the device keeps.
  const b = body<NewPatient>(req)
  if (!/^\d{10,15}$/.test(b.help_phone ?? '')) throw new HttpError(400, 'Invalid help phone')
  const token = newToken()
  const joinToken = newJoinToken() // goes in the link the patient sends to the help person; expires (api/_lib/invite.ts)
  const photo_url = b.photo ? await uploadPhoto(b.photo) : null
  const { data, error } = await db()
    .from('patients')
    .insert({ name: b.name?.slice(0, 40) || null, photo_url, help_phone: b.help_phone, help_name: b.help_name?.slice(0, 40) || null, consented_at: new Date().toISOString(), token_hash: sha256(token), help_join_token: joinToken })
    .select('id')
    .single()
  if (error) dbFailed('patient insert', error)
  // Generate the briefings in the background (best effort) so audio is ready before any emergency
  waitUntil(ensureBriefings(data.id).catch((e) => console.error('[briefing] background failed', safeMessage(e))))
  return { id: data.id, token, join_token: joinToken }
})
