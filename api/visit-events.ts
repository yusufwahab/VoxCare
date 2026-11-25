import { route, body } from './_lib/http.js'
import { HttpError } from './_lib/env.js'
import { db } from './_lib/supabase.js'
import { limit } from './_lib/limit.js'

interface Incoming { id?: unknown; type?: unknown; mode?: unknown; at?: unknown }

/** POST { visitId, code, events }: appends typed events to the visit's transcript. */
export default route(async (req) => {
  const b = body<{ visitId?: string; code?: string; events?: Incoming[] }>(req)
  limit(req, 'visit-events', 600)
  if (!b.visitId || !/^\d{6}$/.test(b.code ?? '') || !Array.isArray(b.events)) throw new HttpError(400, 'Bad request')
  if (b.events.length === 0 || b.events.length > 100 || JSON.stringify(b.events).length > 60_000) throw new HttpError(413, 'Too many events')
  const events = b.events.filter((e) => typeof e.id === 'string' && typeof e.type === 'string' && /^(patient|doctor|visit)\./.test(e.type))
  if (!events.length) throw new HttpError(400, 'No valid events')

  const { data: visit } = await db().from('visits').select('id,code,status').eq('id', b.visitId).maybeSingle()
  if (!visit || visit.code !== b.code) throw new HttpError(404, 'This visit was not found')
  if (visit.status !== 'active') return { ok: true, ended: true }

  const { error } = await db().rpc('append_visit_events', { p_visit: visit.id, p_events: events })
  if (error) throw new HttpError(500, error.message)

  // Keep the visible columns in step with the events
  const lastMode = [...events].reverse().find((e) => e.type === 'visit.mode_changed')
  if (lastMode && (lastMode.mode === 'one' || lastMode.mode === 'two')) await db().from('visits').update({ mode: lastMode.mode }).eq('id', visit.id)
  if (events.some((e) => e.type === 'visit.ended')) await db().from('visits').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', visit.id)
  return { ok: true }
})
