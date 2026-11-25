import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { waitUntil } from '@vercel/functions'
import { route, body, q } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db, isUuid, resolveId, sha256 } from './_lib/supabase.js'
import { sendWelcomeEmail } from './_lib/email.js'
import { isExpired, newJoinToken, TOKEN_SHAPE } from './_lib/invite.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Client-facing messages. Database errors are logged without details and never returned.
const INVALID = 'This link is not valid'
const EXPIRED = 'This link has expired. Ask your friend to send it again.'
const TAKEN = 'Someone has already joined with this link'
const FAILED = 'Could not save. Please try again.'
const NOT_ALLOWED = 'Not allowed'

interface Invite { id: string; name: string | null; photo_url: string | null; help_confirmed_at: string | null; created_at: string | null }

function dbFailed(where: string, code?: string): never {
  console.error(`[join] database error during ${where}`, { code })
  throw new HttpError(500, FAILED, undefined, true)
}

async function byJoinToken(token: unknown): Promise<Invite & { token: string }> {
  if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) throw new HttpError(404, INVALID)
  const { data, error } = await db().from('patients').select('id,name,photo_url,help_confirmed_at,created_at').eq('help_join_token', token).maybeSingle()
  if (error) dbFailed('invite lookup', error.code)
  if (!data) throw new HttpError(404, INVALID)
  return { ...(data as Invite), token }
}

/** The patient's own device proves itself with the secret token from POST /api/patient */
async function byDevice(rawId: unknown, deviceToken: unknown) {
  const id = typeof rawId === 'string' ? resolveId(rawId) : ''
  if (!isUuid(id) || typeof deviceToken !== 'string' || !TOKEN_SHAPE.test(deviceToken)) throw new HttpError(403, NOT_ALLOWED)
  const { data, error } = await db().from('patients').select('id,token_hash,help_join_token,help_confirmed_at,created_at').eq('id', id).maybeSingle()
  if (error) dbFailed('device lookup', error.code)
  const p = data as { id: string; token_hash: string | null; help_join_token: string | null; help_confirmed_at: string | null; created_at: string | null } | null
  const given = Buffer.from(sha256(deviceToken))
  // Unknown patient and wrong token look the same to the caller
  if (!p?.token_hash || p.token_hash.length !== given.length || !timingSafeEqual(Buffer.from(p.token_hash), given)) throw new HttpError(403, NOT_ALLOWED)
  return { ...p, token_hash: p.token_hash }
}

function readBody(req: VercelRequest): Record<string, unknown> {
  try {
    const b = body<unknown>(req)
    if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>
  } catch { /* fall through */ }
  throw new HttpError(400, 'Invalid request')
}

export default route(async (req) => {
  if (req.method === 'GET') {
    // The patient's device asks whether the help person has joined (needs the device secret)
    const patientId = q(req, 'patientId')
    if (patientId) {
      const p = await byDevice(patientId, q(req, 'token'))
      const confirmed = !!p.help_confirmed_at
      return { confirmed, link_expired: !confirmed && (!p.help_join_token || isExpired(p.help_join_token, p.created_at)) }
    }
    // The help person's page asks who invited them
    const p = await byJoinToken(q(req, 'joinToken'))
    if (!p.help_confirmed_at && isExpired(p.token, p.created_at)) throw new HttpError(410, EXPIRED)
    return { name: p.name, photo_url: p.photo_url, joined: !!p.help_confirmed_at }
  }

  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
  const b = readBody(req)

  // The patient's device replaces its invitation link. The old link stops working at once.
  if (b.action === 'reinvite') {
    const p = await byDevice(b.patientId, b.token)
    if (p.help_confirmed_at) throw new HttpError(409, 'Your help person has already joined')
    const joinToken = newJoinToken()
    const { data, error } = await db()
      .from('patients')
      .update({ help_join_token: joinToken })
      .eq('id', p.id)
      .eq('token_hash', p.token_hash)
      .is('help_confirmed_at', null)
      .select('id')
    if (error) dbFailed('reinvite', error.code)
    // The help person joined between the lookup and the update
    if (!Array.isArray(data) || data.length !== 1) throw new HttpError(409, 'Your help person has already joined')
    return { join_token: joinToken }
  }
  if (b.action !== undefined) throw new HttpError(400, 'Invalid request')

  // The help person joins by themselves with their own email
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (!EMAIL.test(email) || email.length > 120) throw new HttpError(400, 'Please check the email address')
  const p = await byJoinToken(b.joinToken)
  if (p.help_confirmed_at) throw new HttpError(409, TAKEN)
  if (isExpired(p.token, p.created_at)) throw new HttpError(410, EXPIRED)

  // Single atomic consume: only succeeds while this exact link is current and nobody has joined.
  // A replayed or concurrent request matches 0 rows and cannot overwrite the help person.
  const { data, error } = await db()
    .from('patients')
    .update({ help_email: email, help_confirmed_at: new Date().toISOString() })
    .eq('id', p.id)
    .eq('help_join_token', p.token)
    .is('help_confirmed_at', null)
    .select('id')
  if (error) dbFailed('join', error.code)
  if (!Array.isArray(data) || data.length !== 1) throw new HttpError(409, TAKEN)

  // The join is saved even if the welcome email fails. Brevo errors can echo the address, so log no details.
  waitUntil(sendWelcomeEmail({ to: email, patientName: p.name, photoUrl: p.photo_url }).catch((e: unknown) => console.error('[join] welcome email failed', { status: e instanceof HttpError ? e.status : undefined })))
  return { ok: true }
})
