import type { Duration, PainKind } from '../lib/sentence'
import type { View } from '../lib/regions'

export type Role = 'doctor' | 'patient'
export type VisitMode = 'one' | 'two'

/** A pin on the body map. Position is a percentage of the mannequin image. */
export interface Pin {
  id: string
  view: View
  x: number
  y: number
  regionName: string
  kind?: PainKind
}

export interface Note {
  id: string
  text: string
  label: string
}

/** What the doctor has put in front of the patient, waiting for a reply */
export type Shown =
  | null
  | { type: 'question'; id: string }
  | { type: 'instruction'; id: string }
  | { type: 'gestures' }
  | { type: 'text'; text: string }

export type AnswerValue = 'yes' | 'no' | { kind: 'where'; pins: Pin[] } | { kind: 'duration'; duration: Duration }

/** Every thing that can happen in a visit. Both transports carry exactly these. */
export type Payload =
  | { type: 'patient.pin_added'; pin: Pin }
  | { type: 'patient.pin_moved'; pinId: string; x: number; y: number; regionName: string }
  | { type: 'patient.pin_removed'; pinId: string }
  | { type: 'patient.pain_type'; pinId: string; kind: PainKind }
  | { type: 'patient.pain_level'; level: number }
  | { type: 'patient.duration'; duration: Duration }
  | { type: 'patient.selected'; group: 'feel' | 'events' | 'feelings'; ids: string[] }
  | { type: 'patient.notes'; notes: Note[] }
  | { type: 'patient.typed'; text: string }
  | { type: 'patient.done' }
  | { type: 'doctor.question'; questionId: string }
  | { type: 'patient.answer'; questionId: string; value: AnswerValue }
  | { type: 'doctor.instruction'; instructionId: string }
  | { type: 'doctor.gestures' }
  | { type: 'doctor.text'; text: string }
  /** instructionId is an instruction id, or 'gestures' or 'text' for those two */
  | { type: 'patient.ack'; instructionId: string }
  | { type: 'patient.picture_requested' }
  | { type: 'visit.patient_joined' }
  | { type: 'visit.mode_changed'; mode: VisitMode }
  | { type: 'visit.ended' }

export interface Stamp {
  /** Unique, so an event received twice is applied once */
  id: string
  at: string
  by: Role
}

export type VisitEvent = Payload & Stamp

export const stamp = (payload: Payload, by: Role): VisitEvent => ({ ...payload, id: crypto.randomUUID(), at: new Date().toISOString(), by })

/** Cheap check for events arriving from the network or the database */
export const isVisitEvent = (x: unknown): x is VisitEvent => {
  const e = x as Partial<VisitEvent> | null
  return !!e && typeof e.id === 'string' && typeof e.type === 'string' && /^(patient|doctor|visit)\./.test(e.type)
}
