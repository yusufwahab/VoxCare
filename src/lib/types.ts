export type FactType = 'condition' | 'allergy' | 'medicine' | 'blood_group' | 'event_history' | 'body_fact'
export type FactStatus = 'self_reported' | 'doctor_verified'
export type Lang = 'en' | 'yo' | 'ig' | 'ha'

export interface Fact {
  id: string
  type: FactType
  value: string
  status: FactStatus
  verified_by?: string | null
  verified_at?: string | null
}

export interface Doctor {
  id: string
  name: string
  mdcn_number: string
  verified: boolean
}

export interface PatientPublic {
  id: string
  name: string | null
  photo_url: string | null
}

/** Exactly what the emergency endpoint returns. Never visit transcripts. */
export interface EmergencyData {
  id: string
  name: string | null
  photo_url: string | null
  help_phone: string
  help_name: string | null
  verified: Fact[]
  unverified: Fact[]
  audio: Partial<Record<Lang, string>>
  text: string
}

export interface TranscriptItem {
  at: string
  who: 'patient' | 'doctor'
  kind: 'statement' | 'question' | 'answer' | 'instruction' | 'note'
  text: string
}

export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'yo', label: 'Yoruba', native: 'Yorùbá' },
  { id: 'ig', label: 'Igbo', native: 'Igbo' },
  { id: 'ha', label: 'Hausa', native: 'Hausa' },
]

export const FACT_LABEL: Record<FactType, string> = {
  condition: 'Condition',
  allergy: 'Allergy',
  medicine: 'Medicine',
  blood_group: 'Blood group',
  event_history: 'History',
  body_fact: 'About me',
}
