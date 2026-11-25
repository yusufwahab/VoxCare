import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env, HttpError } from './env.js'

let client: SupabaseClient | null = null
export function db(): SupabaseClient {
  if (!client) client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  return client
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const newToken = () => randomBytes(24).toString('hex')

/** The client uses the id "demo" for the seeded patient. */
export const DEMO_UUID = '00000000-0000-4000-8000-000000000001'
export const resolveId = (id: string) => (id === 'demo' ? DEMO_UUID : id)
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

// ---- Doctor session tokens (HMAC, 12 hours) ----
const secret = () => env('SUPABASE_SERVICE_ROLE_KEY')

export function signDoctor(doctorId: string): string {
  const exp = Date.now() + 12 * 3600_000
  const payload = `${doctorId}.${exp}`
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('hex')}`
}

export function requireDoctor(authHeader: string | undefined): string {
  const token = (authHeader ?? '').replace(/^Bearer /, '')
  const [id, exp, sig] = token.split('.')
  if (!id || !exp || !sig) throw new HttpError(401, 'Doctor login required')
  const expected = createHmac('sha256', secret()).update(`${id}.${exp}`).digest('hex')
  const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  if (!ok || Number(exp) < Date.now()) throw new HttpError(401, 'Doctor session expired')
  return id
}

export interface PatientRow {
  id: string
  photo_url: string | null
  name: string | null
  help_phone: string
  help_name: string | null
  help_email: string | null
  help_join_token: string | null
  help_confirmed_at: string | null
  token_hash: string | null
}

export async function loadPatient(rawId: string): Promise<PatientRow> {
  const id = resolveId(rawId)
  if (!isUuid(id)) throw new HttpError(404, 'Not found')
  const { data, error } = await db().from('patients').select('*').eq('id', id).maybeSingle()
  if (error) throw new HttpError(500, error.message)
  if (!data) throw new HttpError(404, 'Not found')
  // The seeded demo patient uses a teammate's phone and email from the environment
  if (id === DEMO_UUID) {
    if (process.env.DEMO_HELP_PHONE) data.help_phone = process.env.DEMO_HELP_PHONE
    if (process.env.DEMO_HELP_EMAIL) data.help_email = process.env.DEMO_HELP_EMAIL
  }
  return data as PatientRow
}
