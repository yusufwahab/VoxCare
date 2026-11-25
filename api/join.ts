import { route, body, q } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db, loadPatient, sha256 } from './_lib/supabase.js'
import { sendWelcomeEmail } from './_lib/email.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function byJoinToken(token: string) {
  if (!token || token.length < 8) throw new HttpError(404, 'This link is not valid')
  const { data } = await db().from('patients').select('id,name,photo_url,help_confirmed_at').eq('help_join_token', token).maybeSingle()
  if (!data) throw new HttpError(404, 'This link is not valid')
  return data as { id: string; name: string | null; photo_url: string | null; help_confirmed_at: string | null }
}

export default route(async (req) => {
  if (req.method === 'GET') {
    // The patient's device asks whether the help person has joined (needs the device secret)
    const patientId = q(req, 'patientId')
    if (patientId) {
      const p = await loadPatient(patientId)
      if (sha256(q(req, 'token')) !== p.token_hash) throw new HttpError(403, 'Not allowed')
      return { confirmed: !!p.help_confirmed_at }
    }
    // The help person's page asks who invited them
    const p = await byJoinToken(q(req, 'joinToken'))
    return { name: p.name, photo_url: p.photo_url, joined: !!p.help_confirmed_at }
  }

  // The help person joins by themselves with their own email
  const b = body<{ joinToken: string; email: string }>(req)
  const email = (b.email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 120) throw new HttpError(400, 'Please check the email address')
  const p = await byJoinToken(b.joinToken)
  const { error } = await db().from('patients').update({ help_email: email, help_confirmed_at: new Date().toISOString() }).eq('id', p.id)
  if (error) throw new HttpError(500, error.message)
  // The join is saved even if the welcome email fails, but we wait for the result so we can say so honestly
  try {
    await sendWelcomeEmail({ to: email, patientName: p.name, photoUrl: p.photo_url })
    return { ok: true, emailed: true }
  } catch (e) {
    console.error('[join] welcome email FAILED:', e instanceof Error ? e.message : e)
    return { ok: true, emailed: false }
  }
})
