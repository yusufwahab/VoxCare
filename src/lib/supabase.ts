import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.SUPABASE_URL as string | undefined
const key = import.meta.env.SUPABASE_ANON_KEY as string | undefined

/** Realtime (two-device visits) needs the project URL and the public anon key in the frontend build. */
export const realtimeConfigured = !!url && !!key

let client: SupabaseClient | null = null
export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error('Two-device visits need SUPABASE_URL and SUPABASE_ANON_KEY in the frontend settings.')
  client ??= createClient(url, key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } })
  return client
}
