import { create } from 'zustand'
import { getVisit } from '../lib/api'
import { realtimeConfigured } from '../lib/supabase'
import { speak } from '../lib/speech'
import type { View } from '../lib/regions'
import { stamp, type Payload, type Role, type VisitEvent, type VisitMode } from './events'
import { CORE_KEYS, initialCore, replay, sentenceFrom, visitReducer, type Answer, type VisitCore } from './reducer'
import { createPersister, createRealtimeTransport, type Connection, type Persister, type RealtimeTransport } from './transport'

export { sentenceFrom }
export type PatientScreen = 'menu' | 'body' | 'kind' | 'level' | 'howlong' | 'feel' | 'events' | 'feelings' | 'allergy' | 'other'

/** What only this device cares about. Never sent to the other device. */
interface Ui {
  screen: PatientScreen
  view: View
  sentenceOpen: boolean
  answerOpen: Answer | null
}

interface Session {
  visitId: string | null
  code: string | null
  /** Which side of the conversation this device is on. One-device visits run as 'doctor'. */
  role: Role
  patientId: string | null
  patientName: string | null
  patientPhoto: string | null
  connection: Connection
  peerPresent: boolean
  voiceReady: boolean
}

export interface BeginOptions {
  visitId: string | null
  code: string | null
  role: Role
  mode: VisitMode
  patient?: { id: string | null; name: string | null; photo: string | null }
  /** Events already saved for this visit (a device joining or resuming) */
  events?: VisitEvent[]
}

interface Actions {
  begin: (o: BeginOptions) => void
  /** Do something in the visit. Applies here, sends to the other device, saves to the transcript. */
  dispatch: (p: Payload) => void
  /** An event arrived from the other device */
  receive: (e: VisitEvent) => void
  /** Change local-only screen state */
  set: (p: Partial<Ui>) => void
  setVoiceReady: () => void
  resync: () => Promise<void>
  /** Finish: tell the other device, flush the transcript, disconnect */
  end: () => Promise<void>
  reset: () => void
}

export type VisitState = VisitCore & Ui & Session & Actions

const freshUi: Ui = { screen: 'menu', view: 'front', sentenceOpen: false, answerOpen: null }
const freshSession: Session = { visitId: null, code: null, role: 'doctor', patientId: null, patientName: null, patientPhoto: null, connection: 'local', peerPresent: false, voiceReady: false }

let transport: RealtimeTransport | null = null
let persister: Persister | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
const onHide = () => void persister?.flush(true)

const pickCore = (s: VisitState): VisitCore => Object.fromEntries(CORE_KEYS.map((k) => [k, s[k]])) as unknown as VisitCore

export const useVisit = create<VisitState>((set, get) => {
  /** Connect when two devices are involved. The doctor only needs the channel in two-device mode. */
  const syncTransport = () => {
    const s = get()
    const want = !!s.visitId && realtimeConfigured && (s.role === 'patient' || s.mode === 'two')
    if (want && !transport && s.visitId) {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
      transport = createRealtimeTransport(s.visitId, s.role, {
        onEvent: (e) => get().receive(e),
        onStatus: (connection) => set({ connection }),
        onPeer: (peerPresent) => set({ peerPresent }),
        onResync: () => void get().resync(),
      })
    } else if (!want && transport) {
      // give the "moved to one device" event a moment to leave
      closeTimer = setTimeout(() => { transport?.close(); transport = null; closeTimer = null; set({ connection: 'local', peerPresent: false }) }, 700)
    }
  }

  const effects = (next: VisitCore, e: VisitEvent) => {
    const { role } = get()
    const doctorDevice = role === 'doctor'
    switch (e.type) {
      case 'patient.done':
        if (next.submitted) {
          set({ sentenceOpen: true })
          if (doctorDevice) speak(next.submitted)
        }
        break
      case 'patient.answer':
      case 'patient.ack': {
        const a = next.answers.at(-1)
        if (a) {
          set({ answerOpen: a })
          if (doctorDevice) speak(e.type === 'patient.ack' ? 'I understand.' : a.answer)
        }
        break
      }
      case 'doctor.question':
      case 'doctor.instruction':
      case 'doctor.gestures':
      case 'doctor.text':
        if (role === 'patient') navigator.vibrate?.(200)
        // a shared device says the question aloud for the patient's side of the room
        if (doctorDevice && next.mode === 'one' && (e.type === 'doctor.question' || e.type === 'doctor.instruction')) speak(next.summary.at(-1)?.text ?? '')
        break
      case 'visit.mode_changed':
        syncTransport()
        break
    }
  }

  const apply = (e: VisitEvent, silent = false) => {
    const prev = pickCore(get())
    const next = visitReducer(prev, e)
    if (next === prev) return
    set(next)
    if (!silent) effects(next, e)
  }

  return {
    ...initialCore(),
    ...freshUi,
    ...freshSession,

    begin: ({ visitId, code, role, mode, patient, events }) => {
      get().reset()
      const core = replay(events ?? [], initialCore(mode))
      set({ ...core, ...freshUi, ...freshSession, visitId, code, role, patientId: patient?.id ?? null, patientName: patient?.name ?? null, patientPhoto: patient?.photo ?? null })
      if (visitId && code) {
        persister = createPersister(visitId, code)
        window.addEventListener('pagehide', onHide)
      }
      syncTransport()
      // one device: the patient is right here
      if (mode === 'one' && role === 'doctor') get().dispatch({ type: 'visit.patient_joined' })
    },

    dispatch: (p) => {
      const e = stamp(p, get().role)
      apply(e)
      transport?.send(e)
      persister?.push(e)
    },

    receive: (e) => apply(e),

    set: (p) => set(p),
    setVoiceReady: () => set({ voiceReady: true }),

    resync: async () => {
      const { visitId, code } = get()
      if (!visitId || !code) return
      try {
        const info = await getVisit(visitId, code)
        for (const e of info.transcript ?? []) apply(e, true)
      } catch { /* the next reconnect tries again */ }
    },

    end: async () => {
      if (get().ended) return
      get().dispatch({ type: 'visit.ended' })
      await persister?.flush()
      persister?.stop()
    },

    reset: () => {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
      transport?.close()
      transport = null
      persister?.stop()
      persister = null
      window.removeEventListener('pagehide', onHide)
      set({ ...initialCore(), ...freshUi, ...freshSession })
    },
  }
})
