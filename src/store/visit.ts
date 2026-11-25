import { create } from 'zustand'
import { buildSentence, type Duration, type PainKind } from '../lib/sentence'
import { regionPhrase } from '../lib/regions'
import type { Pin } from '../components/BodyMap'
import type { TranscriptItem } from '../lib/types'

export type PatientScreen = 'menu' | 'body' | 'kind' | 'level' | 'howlong' | 'feel' | 'events' | 'feelings' | 'allergy' | 'other'

export type Shown =
  | null
  | { type: 'question'; id: string }
  | { type: 'where' }
  | { type: 'instruction'; id: string }
  | { type: 'gestures' }
  | { type: 'text'; text: string }

export interface Answer { at: string; question: string; answer: string }

interface VisitState {
  patientId: string | null
  patientName: string | null
  patientPhoto: string | null
  screen: PatientScreen
  view: 'front' | 'back'
  pins: Pin[]
  level?: number
  duration?: Duration
  feel: string[]
  events: string[]
  feelings: string[]
  notes: { id: string; text: string; label: string }[]
  typed: string
  submitted: string | null
  submittedPins: Pin[]
  shown: Shown
  answers: Answer[]
  pictureRequested: boolean
  transcript: TranscriptItem[]
  start: (p: { id: string | null; name: string | null; photo: string | null }) => void
  set: (p: Partial<VisitState>) => void
  toggle: (key: 'feel' | 'events' | 'feelings', id: string) => void
  toggleNote: (n: { id: string; text: string; label: string }) => void
  setKind: (pinId: string, kind: PainKind) => void
  submit: () => string
  log: (item: Omit<TranscriptItem, 'at'>) => void
  addAnswer: (question: string, answer: string) => void
  reset: () => void
}

const blank = {
  patientId: null, patientName: null, patientPhoto: null, screen: 'menu' as PatientScreen, view: 'front' as const, pins: [] as Pin[],
  level: undefined, duration: undefined, feel: [] as string[], events: [] as string[], feelings: [] as string[], notes: [] as { id: string; text: string; label: string }[],
  typed: '', submitted: null, submittedPins: [] as Pin[], shown: null as Shown, answers: [] as Answer[], pictureRequested: false, transcript: [] as TranscriptItem[],
}

export const sentenceFrom = (s: Pick<VisitState, 'pins' | 'level' | 'duration' | 'feel' | 'events' | 'feelings' | 'notes' | 'typed'>) =>
  buildSentence({
    pains: s.pins.map((p) => ({ phrase: regionPhrase({ name: p.regionName }), kind: p.kind })),
    level: s.level,
    duration: s.duration,
    feel: s.feel,
    events: s.events,
    feelings: s.feelings,
    notes: [...s.notes.map((n) => n.text), ...(s.typed.trim() ? [s.typed.trim()] : [])],
  })

export const useVisit = create<VisitState>((set, get) => ({
  ...blank,
  start: ({ id, name, photo }) => set({ ...blank, patientId: id, patientName: name, patientPhoto: photo }),
  set: (p) => set(p),
  toggle: (key, id) => set((s) => ({ [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] }) as Partial<VisitState>),
  toggleNote: (n) => set((s) => ({ notes: s.notes.some((x) => x.id === n.id) ? s.notes.filter((x) => x.id !== n.id) : [...s.notes, n] })),
  setKind: (pinId, kind) => set((s) => ({ pins: s.pins.map((p) => (p.id === pinId ? { ...p, kind } : p)) })),
  submit: () => {
    const text = sentenceFrom(get())
    set((s) => ({
      submitted: text,
      submittedPins: s.pins,
      screen: 'menu',
      transcript: [...s.transcript, { at: new Date().toISOString(), who: 'patient', kind: 'statement', text }],
    }))
    return text
  },
  log: (item) => set((s) => ({ transcript: [...s.transcript, { ...item, at: new Date().toISOString() }] })),
  addAnswer: (question, answer) =>
    set((s) => ({
      answers: [...s.answers, { at: new Date().toISOString(), question, answer }],
      transcript: [...s.transcript, { at: new Date().toISOString(), who: 'patient', kind: 'answer', text: `${question} ${answer}` }],
    })),
  reset: () => set({ ...blank }),
}))
