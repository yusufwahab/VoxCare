import type { RealtimeChannel } from '@supabase/supabase-js'
import { appendVisitEvents } from '../lib/api'
import { getSupabase } from '../lib/supabase'
import { isVisitEvent, type Role, type VisitEvent } from './events'

export type Connection = 'local' | 'connecting' | 'connected' | 'reconnecting'

export interface RealtimeHandlers {
  onEvent: (e: VisitEvent) => void
  onStatus: (c: Connection) => void
  /** The other device is (or is not) in the visit right now */
  onPeer: (present: boolean) => void
  /** We were offline and are back: fetch what we missed */
  onResync: () => void
}

export interface RealtimeTransport {
  send: (e: VisitEvent) => void
  close: () => void
}

const MOVE_THROTTLE_MS = 80

/**
 * Realtime transport: Supabase Realtime Broadcast on the channel "visit:<visitId>".
 * Presence says whether the other device is here. Drag moves are throttled so a pin follows the finger smoothly.
 */
export function createRealtimeTransport(visitId: string, role: Role, h: RealtimeHandlers): RealtimeTransport {
  const channel: RealtimeChannel = getSupabase().channel(`visit:${visitId}`, { config: { broadcast: { self: false }, presence: { key: role } } })
  let everConnected = false
  let closed = false
  const pendingMoves = new Map<string, VisitEvent>()
  let moveTimer: ReturnType<typeof setTimeout> | null = null

  const raw = (e: VisitEvent) => void channel.send({ type: 'broadcast', event: 've', payload: e })
  const flushMoves = () => {
    moveTimer = null
    for (const e of pendingMoves.values()) raw(e)
    pendingMoves.clear()
  }

  h.onStatus('connecting')
  channel
    .on('broadcast', { event: 've' }, ({ payload }) => { if (isVisitEvent(payload)) h.onEvent(payload) })
    .on('presence', { event: 'sync' }, () => h.onPeer(Object.keys(channel.presenceState()).some((k) => k !== role)))
    .subscribe(async (status) => {
      if (closed) return
      if (status === 'SUBSCRIBED') {
        await channel.track({ role, at: Date.now() })
        h.onStatus('connected')
        if (everConnected) h.onResync()
        everConnected = true
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        h.onStatus('reconnecting')
      }
    })

  return {
    send(e) {
      if (e.type === 'patient.pin_moved') {
        pendingMoves.set(e.pinId, e)
        moveTimer ??= setTimeout(flushMoves, MOVE_THROTTLE_MS)
        return
      }
      // anything else keeps its place in line behind a pending move
      if (moveTimer) { clearTimeout(moveTimer); flushMoves() }
      raw(e)
    },
    close() {
      closed = true
      if (moveTimer) clearTimeout(moveTimer)
      void getSupabase().removeChannel(channel)
    },
  }
}

export interface Persister {
  push: (e: VisitEvent) => void
  flush: (keepalive?: boolean) => Promise<void>
  stop: () => void
}

/**
 * Saves every event to the visit's transcript in the database (the sender saves its own events).
 * Batches every second, keeps the last of a run of pin moves, and retries after a failure.
 */
export function createPersister(visitId: string, code: string): Persister {
  let queue: VisitEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let inflight: Promise<void> | null = null
  let stopped = false

  const collapse = (events: VisitEvent[]) =>
    events.filter((e, i) => !(e.type === 'patient.pin_moved' && events[i + 1]?.type === 'patient.pin_moved' && (events[i + 1] as { pinId?: string }).pinId === e.pinId))

  const flush = async (keepalive = false): Promise<void> => {
    if (timer) { clearTimeout(timer); timer = null }
    await inflight
    if (!queue.length) return
    const taken = queue.slice(0, 100)
    const batch = collapse(taken)
    const count = taken.length
    inflight = appendVisitEvents(visitId, code, batch, keepalive)
      .then(() => { queue = queue.slice(count) })
      .catch(() => { if (!stopped) timer = setTimeout(() => void flush(), 3000) })
      .finally(() => { inflight = null })
    await inflight
    if (queue.length && !timer && !stopped) timer = setTimeout(() => void flush(), 1000)
  }

  return {
    push(e) {
      queue.push(e)
      timer ??= setTimeout(() => void flush(), 1000)
    },
    flush,
    stop() { stopped = true; if (timer) clearTimeout(timer) },
  }
}

/** Card scanned: knock on the patient's phone (if VoxCare is open there) so it can ask Allow or No */
export async function sendJoinPrompt(patientId: string, visitId: string, code: string): Promise<void> {
  const sb = getSupabase()
  const ch = sb.channel(`patient:${patientId}`)
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 4000)
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.send({ type: 'broadcast', event: 'join', payload: { visitId, code } })
        clearTimeout(t)
        resolve()
      }
    })
  })
  void sb.removeChannel(ch)
}
