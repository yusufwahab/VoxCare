import { ANSWERS, INSTRUCTIONS, QUESTIONS } from '../data/assets'
import { regionPhrase } from '../lib/regions'
import { buildSentence, durationSentence, type Duration } from '../lib/sentence'
import type { TranscriptItem } from '../lib/types'
import type { Note, Pin, Shown, VisitEvent, VisitMode } from './events'

export interface Answer {
  at: string
  question: string
  answer: string
}

/** Everything that is shared between the two devices. Local screen state lives elsewhere. */
export interface VisitCore {
  mode: VisitMode
  patientJoined: boolean
  ended: boolean
  pins: Pin[]
  level?: number
  duration?: Duration
  feel: string[]
  events: string[]
  feelings: string[]
  notes: Note[]
  typed: string
  submitted: string | null
  submittedPins: Pin[]
  shown: Shown
  answers: Answer[]
  pictureRequested: boolean
  /** Human-readable lines for the summary screen */
  summary: TranscriptItem[]
  /** Ids of events already applied */
  seen: Record<string, true>
}

export const initialCore = (mode: VisitMode = 'one'): VisitCore => ({
  mode, patientJoined: false, ended: false, pins: [], level: undefined, duration: undefined,
  feel: [], events: [], feelings: [], notes: [], typed: '', submitted: null, submittedPins: [],
  shown: null, answers: [], pictureRequested: false, summary: [], seen: {},
})

export const CORE_KEYS = Object.keys(initialCore()) as (keyof VisitCore)[]

export const sentenceFrom = (s: Pick<VisitCore, 'pins' | 'level' | 'duration' | 'feel' | 'events' | 'feelings' | 'notes' | 'typed'>) =>
  buildSentence({
    pains: s.pins.map((p) => ({ phrase: regionPhrase({ name: p.regionName }), kind: p.kind })),
    level: s.level,
    duration: s.duration,
    feel: s.feel,
    events: s.events,
    feelings: s.feelings,
    notes: [...s.notes.map((n) => n.text), ...(s.typed.trim() ? [s.typed.trim()] : [])],
  })

const line = (at: string, who: 'patient' | 'doctor', kind: TranscriptItem['kind'], text: string): TranscriptItem => ({ at, who, kind, text })

/** The one place visit state changes. Pure: the same events always give the same state. */
export function visitReducer(state: VisitCore, e: VisitEvent): VisitCore {
  if (state.seen[e.id]) return state
  const s: VisitCore = { ...state, seen: { ...state.seen, [e.id]: true } }

  switch (e.type) {
    case 'patient.pin_added':
      return s.pins.some((p) => p.id === e.pin.id) ? s : { ...s, pins: [...s.pins, e.pin] }
    case 'patient.pin_moved':
      return { ...s, pins: s.pins.map((p) => (p.id === e.pinId ? { ...p, x: e.x, y: e.y, regionName: e.regionName } : p)) }
    case 'patient.pin_removed':
      return { ...s, pins: s.pins.filter((p) => p.id !== e.pinId) }
    case 'patient.pain_type':
      return { ...s, pins: s.pins.map((p) => (p.id === e.pinId ? { ...p, kind: e.kind } : p)) }
    case 'patient.pain_level':
      return { ...s, level: e.level }
    case 'patient.duration':
      return { ...s, duration: e.duration }
    case 'patient.selected':
      return { ...s, [e.group]: e.ids }
    case 'patient.notes':
      return { ...s, notes: e.notes }
    case 'patient.typed':
      return { ...s, typed: e.text }

    case 'patient.done': {
      const text = sentenceFrom(s)
      if (!text) return s
      return { ...s, submitted: text, submittedPins: s.pins, summary: [...s.summary, line(e.at, 'patient', 'statement', text)] }
    }

    case 'doctor.question': {
      const q = QUESTIONS.find((x) => x.id === e.questionId)
      return { ...s, shown: { type: 'question', id: e.questionId }, pictureRequested: false, summary: [...s.summary, line(e.at, 'doctor', 'question', q?.doctorText ?? e.questionId)] }
    }
    case 'doctor.instruction': {
      const i = INSTRUCTIONS.find((x) => x.id === e.instructionId)
      return { ...s, shown: { type: 'instruction', id: e.instructionId }, summary: [...s.summary, line(e.at, 'doctor', 'instruction', i?.doctorText ?? e.instructionId)] }
    }
    case 'doctor.gestures':
      return { ...s, shown: { type: 'gestures' }, summary: [...s.summary, line(e.at, 'doctor', 'instruction', 'Showed hand signs')] }
    case 'doctor.text':
      return { ...s, shown: { type: 'text', text: e.text }, pictureRequested: false, summary: [...s.summary, line(e.at, 'doctor', 'note', e.text)] }

    case 'patient.answer': {
      const q = QUESTIONS.find((x) => x.id === e.questionId)
      const question = q?.doctorText ?? e.questionId
      let answer: string
      if (e.value === 'yes' || e.value === 'no') answer = ANSWERS[e.questionId]?.[e.value] ?? (e.value === 'yes' ? 'Yes.' : 'No.')
      else if (e.value.kind === 'where') answer = `It hurts at: ${e.value.pins.map((p) => p.regionName.toLowerCase()).join(', ')}`
      else answer = durationSentence(e.value.duration, true)
      return {
        ...s, shown: null,
        answers: [...s.answers, { at: e.at, question, answer }],
        summary: [...s.summary, line(e.at, 'patient', 'answer', `${question} ${answer}`)],
      }
    }
    case 'patient.ack': {
      const shown = s.shown
      const question =
        e.instructionId === 'gestures' ? 'Hand signs'
        : e.instructionId === 'text' ? (shown?.type === 'text' ? shown.text : 'Message')
        : (INSTRUCTIONS.find((x) => x.id === e.instructionId)?.doctorText ?? e.instructionId)
      return {
        ...s, shown: null,
        answers: [...s.answers, { at: e.at, question, answer: 'Understood' }],
        summary: [...s.summary, line(e.at, 'patient', 'answer', `${question} Understood`)],
      }
    }
    case 'patient.picture_requested':
      return { ...s, shown: null, pictureRequested: true }

    case 'visit.patient_joined':
      return { ...s, patientJoined: true }
    case 'visit.mode_changed':
      return { ...s, mode: e.mode }
    case 'visit.ended':
      return { ...s, ended: true }
  }
}

/** Rebuild state from a saved list of events (used when a device joins or reconnects) */
export const replay = (events: VisitEvent[], from: VisitCore = initialCore()): VisitCore => events.reduce(visitReducer, from)
