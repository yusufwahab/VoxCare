/**
 * Client API. Calls the Vercel `/api` functions. If the backend is not reachable (local dev without
 * keys, or offline) it falls back to a seeded mock stored in localStorage so the whole flow still works.
 */
import { briefingText } from './briefingText'
import type { Doctor, EmergencyData, Fact, FactStatus, FactType, Lang, PatientPublic } from './types'
import type { VisitEvent, VisitMode } from '../visit/events'

export const DEMO_ID = 'demo'

interface MockPatient {
  id: string
  token: string
  name: string | null
  photo: string | null
  help_phone: string
  help_name: string | null
  facts: Fact[]
  consented_at: string
  join_token: string
  help_email: string | null
  help_confirmed_at: string | null
}
interface MockDb {
  patients: Record<string, MockPatient>
  alerts: Record<string, number>
}

const KEY = 'vc-mock-db'
const uid = () => crypto.randomUUID()

function seed(): MockDb {
  const now = new Date().toISOString()
  const v = (type: FactType, value: string): Fact => ({ id: uid(), type, value, status: 'doctor_verified', verified_by: 'doc-ngozi', verified_at: now })
  return {
    patients: {
      [DEMO_ID]: {
        id: DEMO_ID, token: 'demo-token', name: 'Chinedu', photo: null, help_phone: '08000000000', help_name: 'Mum', consented_at: now, join_token: 'demo-join-token', help_email: 'demo@example.com', help_confirmed_at: now,
        facts: [
          v('condition', 'Asthma'), v('allergy', 'Penicillin'), v('blood_group', 'O+'),
          { id: uid(), type: 'condition', value: 'Fainting sometimes', status: 'self_reported' },
        ],
      },
    },
    alerts: {},
  }
}

function db(): MockDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch { /* ignore */ }
  const d = seed()
  save(d)
  return d
}
function save(d: MockDb) {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* ignore */ }
}

/** Where the backend lives. Empty in dev (same server). On Vercel set VITE_API_URL to the Render URL. */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')
/** The seeded mock is for local development only. A real deployment never fakes data. */
const MOCK_ALLOWED = import.meta.env.DEV

let backendUp: boolean | null = null
let authToken: string | null = null

async function call<T>(path: string, init: RequestInit | undefined, mock: () => T | Promise<T>): Promise<{ data: T; mock: boolean }> {
  if (backendUp !== false || !MOCK_ALLOWED) {
    try {
      const res = await fetch(API_BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(init?.headers ?? {}) } })
      const type = res.headers.get('content-type') ?? ''
      if (type.includes('application/json')) {
        backendUp = true
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
        return { data: (await res.json()) as T, mock: false }
      }
      if (!MOCK_ALLOWED) throw new Error('The server is not reachable. Check the API address.')
      backendUp = false // got HTML (dev server fallback) so there is no backend
    } catch (e) {
      if (backendUp === true || !MOCK_ALLOWED) throw e
      backendUp = false
    }
  }
  return { data: await mock(), mock: true }
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const isMockBackend = () => backendUp === false

// ---- Doctor ----
export async function doctorLogin(pin: string): Promise<Doctor | null> {
  const { data } = await call<{ doctor: Doctor | null; token?: string }>('/api/doctor-login', post({ pin }), () => ({
    doctor: pin === '1234' ? { id: 'doc-ngozi', name: 'Dr. Ngozi Okafor', mdcn_number: 'MDCN/R/12345', verified: true } : null,
  }))
  authToken = data.token ?? null
  return data.doctor
}

// ---- Patient ----
export interface NewPatient { name?: string | null; photo?: string | null; help_phone: string; help_name?: string | null }

export async function createPatient(p: NewPatient): Promise<{ id: string; token: string; join_token: string }> {
  const { data } = await call<{ id: string; token: string; join_token: string }>('/api/patient', post(p), () => {
    const d = db()
    const id = uid()
    const token = uid()
    const join_token = uid()
    d.patients[id] = { id, token, join_token, help_email: null, help_confirmed_at: null, name: p.name ?? null, photo: p.photo ?? null, help_phone: p.help_phone, help_name: p.help_name ?? null, facts: [], consented_at: new Date().toISOString() }
    save(d)
    return { id, token, join_token }
  })
  return data
}

// ---- Help person joins by themselves ----
export async function getHelpStatus(patientId: string, token: string): Promise<boolean> {
  const { data } = await call<{ confirmed: boolean }>(`/api/join?patientId=${encodeURIComponent(patientId)}&token=${encodeURIComponent(token)}`, undefined, () => ({
    confirmed: !!db().patients[patientId]?.help_confirmed_at,
  }))
  return data.confirmed
}

export interface JoinInfo { name: string | null; photo_url: string | null; joined: boolean }

export async function getJoinInfo(joinToken: string): Promise<JoinInfo | null> {
  try {
    const { data } = await call<JoinInfo | null>(`/api/join?joinToken=${encodeURIComponent(joinToken)}`, undefined, () => {
      const p = Object.values(db().patients).find((x) => x.join_token === joinToken)
      return p ? { name: p.name, photo_url: p.photo, joined: !!p.help_confirmed_at } : null
    })
    return data
  } catch { return null }
}

export async function joinAsHelper(joinToken: string, email: string): Promise<{ emailed?: boolean }> {
  const { data } = await call<{ ok: boolean; emailed?: boolean }>('/api/join', post({ joinToken, email }), () => {
    const d = db()
    const p = Object.values(d.patients).find((x) => x.join_token === joinToken)
    if (!p) throw new Error('This link is not valid')
    p.help_email = email
    p.help_confirmed_at = new Date().toISOString()
    save(d)
    return { ok: true }
  })
  return { emailed: data.emailed }
}

export async function getPatientPublic(id: string): Promise<PatientPublic | null> {
  const { data } = await call<PatientPublic | null>(`/api/patient?id=${encodeURIComponent(id)}`, undefined, () => {
    const p = db().patients[id]
    return p ? { id: p.id, name: p.name, photo_url: p.photo } : null
  })
  return data
}

export async function getFactsForDoctor(patientId: string, doctorId: string): Promise<Fact[]> {
  const { data } = await call<{ facts: Fact[] }>(`/api/facts?patientId=${encodeURIComponent(patientId)}&doctorId=${encodeURIComponent(doctorId)}`, undefined, () => ({
    facts: db().patients[patientId]?.facts ?? [],
  }))
  return data.facts
}

/** Patient adds facts to their own card (self reported). Needs the device token. */
export async function addSelfFacts(patientId: string, token: string, facts: { type: FactType; value: string }[]): Promise<void> {
  await call('/api/facts', post({ action: 'self', patientId, token, facts }), () => {
    const d = db()
    const p = d.patients[patientId]
    if (p && p.token === token) {
      for (const f of facts) if (!p.facts.some((x) => x.value === f.value && x.type === f.type)) p.facts.push({ id: uid(), type: f.type, value: f.value, status: 'self_reported' })
      save(d)
    }
  })
}

export interface VerifiedFactInput { id?: string; type: FactType; value: string }

/** Close the visit. With a patient, also saves the facts the doctor confirmed (and refreshes the briefing). */
export async function finishVisit(args: { visitId: string; patientId: string | null; doctorId: string; facts: VerifiedFactInput[]; remove?: string[]; summary: string }): Promise<void> {
  await call('/api/verify', post(args), () => {
    const d = db()
    const p = args.patientId ? d.patients[args.patientId] : undefined
    const at = new Date().toISOString()
    if (p) {
      for (const f of args.facts) {
        const existing = f.id ? p.facts.find((x) => x.id === f.id) : p.facts.find((x) => x.type === f.type && x.value.toLowerCase() === f.value.toLowerCase())
        const status: FactStatus = 'doctor_verified'
        if (existing) Object.assign(existing, { type: f.type, value: f.value, status, verified_by: args.doctorId, verified_at: at })
        else p.facts.push({ id: uid(), type: f.type, value: f.value, status, verified_by: args.doctorId, verified_at: at })
      }
      p.facts = p.facts.filter((x) => !args.remove?.includes(x.id))
      save(d)
    }
  })
  if (args.patientId) void requestBriefing(args.patientId)
}

// ---- Visits (one device or two) ----
export interface VisitInfo {
  id: string
  mode: VisitMode
  status?: 'active' | 'ended'
  doctor: { name: string; mdcn_number: string; verified: boolean } | null
  patient: { name: string | null; photo_url: string | null } | null
  transcript?: VisitEvent[]
}

export async function createVisit(patientId: string | null, mode: VisitMode): Promise<{ id: string; code: string }> {
  const { data } = await call<{ id: string; code: string }>('/api/visit', post({ patientId, mode }), () => ({ id: uid(), code: String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0') }))
  return data
}

/** A device that knows the visit id and code gets the whole visit, to replay it */
export async function getVisit(id: string, code: string): Promise<VisitInfo> {
  const { data } = await call<VisitInfo>(`/api/visit?id=${encodeURIComponent(id)}&code=${code}`, undefined, () => { throw new Error('Two-device visits need the server.') })
  return data
}

/** The patient typed the 6-digit code: who is calling? (no conversation is returned) */
export async function lookupVisit(code: string): Promise<VisitInfo> {
  const { data } = await call<VisitInfo>(`/api/visit?code=${code}`, undefined, () => { throw new Error('Two-device visits need the server.') })
  return data
}

/** Saves events to the visit. Fails quietly in the mock; the caller retries on real errors. */
export async function appendVisitEvents(visitId: string, code: string, events: VisitEvent[], keepalive = false): Promise<void> {
  const res = await fetch(API_BASE + '/api/visit-events', {
    method: 'POST', keepalive,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitId, code, events }),
  })
  if (res.status === 404 && MOCK_ALLOWED) return // no backend in dev: nothing to save to
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

// ---- Briefing ----
export async function requestBriefing(patientId: string): Promise<void> {
  try { await call('/api/briefing', post({ patientId }), () => null) } catch { /* background */ }
}

// ---- Emergency ----
export async function getEmergency(id: string): Promise<EmergencyData | null> {
  const { data } = await call<EmergencyData | null>(`/api/emergency?id=${encodeURIComponent(id)}`, undefined, () => {
    const p = db().patients[id]
    if (!p) return null
    const verified = p.facts.filter((f) => f.status === 'doctor_verified')
    const unverified = p.facts.filter((f) => f.status !== 'doctor_verified')
    return {
      id: p.id, name: p.name, photo_url: p.photo, help_phone: p.help_phone, help_name: p.help_name, verified, unverified,
      audio: {} as Partial<Record<Lang, string>>, text: briefingText(p.name, verified, unverified),
    }
  })
  return data
}

export async function sendAlert(patientId: string, loc?: { lat: number; lng: number }): Promise<{ sent: boolean; reason?: string; mock?: boolean }> {
  const { data, mock } = await call<{ sent: boolean; reason?: string }>('/api/alert', post({ patientId, ...loc }), () => {
    const d = db()
    const last = d.alerts[patientId] ?? 0
    if (Date.now() - last < 10 * 60_000) return { sent: true, reason: 'rate_limited' }
    d.alerts[patientId] = Date.now()
    save(d)
    return { sent: true }
  })
  return { ...data, mock }
}
