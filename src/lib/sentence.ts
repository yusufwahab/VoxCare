import { byId } from '../data/assets'

export type PainKind = 'pressing' | 'burning' | 'sharp' | 'throbbing' | 'cramping'
export type PresetDuration = 'today' | 'few' | 'week' | 'longer'
export type Duration = { type: 'days'; n: number } | { type: 'preset'; key: PresetDuration }

export interface PainEntry {
  /** e.g. "my right knee" */
  phrase: string
  kind?: PainKind
}

export interface SentenceInput {
  pains?: PainEntry[]
  /** 0-4, index into the faces */
  level?: number
  duration?: Duration
  /** ids from the FEEL catalogue */
  feel?: string[]
  /** ids from the EVENTS catalogue */
  events?: string[]
  /** ids from the FEELINGS catalogue */
  feelings?: string[]
  /** extra full sentences (allergy, medicine, other) */
  notes?: string[]
}

export function listJoin(items: string[], conj = 'and'): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`
  return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`
}

const dedupe = <T,>(xs: T[]) => [...new Set(xs)]

const LEVEL_TEXT = [
  'It does not hurt much.',
  'It is a little bad.',
  'It is bad.',
  'It is very bad.',
  'It is the worst pain I have had.',
]

export function painSentence(pains: PainEntry[]): string {
  const groups = new Map<string, string[]>()
  for (const p of pains) {
    const key = p.kind ?? ''
    const list = groups.get(key) ?? []
    if (!list.includes(p.phrase)) list.push(p.phrase)
    groups.set(key, list)
  }
  const parts = [...groups.entries()].map(([kind, phrases]) => {
    const art = kind ? `a ${kind} pain` : 'pain'
    return `${art} in ${listJoin(phrases)}`
  })
  const anyMulti = [...groups.values()].some((v) => v.length > 1)
  const body =
    parts.length > 1 && anyMulti
      ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
      : listJoin(parts)
  return `I have ${body}.`
}

export function durationSentence(d: Duration, hasPain: boolean): string {
  const lead = hasPain ? 'It' : 'This'
  if (d.type === 'preset') {
    const map: Record<PresetDuration, string> = {
      today: 'today',
      few: 'a few days ago',
      week: 'about a week ago',
      longer: 'more than a week ago',
    }
    return `${lead} started ${map[d.key]}.`
  }
  const n = Math.max(0, Math.round(d.n))
  if (n === 0) return `${lead} started today.`
  if (n === 1) return `${lead} started yesterday.`
  if (n === 7) return `${lead} started a week ago.`
  if (n >= 60) return `${lead} started more than two months ago.`
  if (n >= 14 && n % 7 === 0) return `${lead} started ${n / 7} weeks ago.`
  if (n >= 30) return `${lead} started about ${Math.round(n / 7)} weeks ago.`
  return `${lead} started ${n} days ago.`
}

const stripI = (s: string) => s.replace(/^I /, '')

/** Turn everything the patient chose into natural English. */
export function buildSentence(input: SentenceInput): string {
  const out: string[] = []
  const pains = input.pains ?? []
  const hasPain = pains.length > 0

  if (hasPain) {
    out.push(painSentence(pains))
    if (input.level !== undefined && LEVEL_TEXT[input.level]) out.push(LEVEL_TEXT[input.level])
  }
  const hasSymptoms = (input.feel?.length ?? 0) + (input.events?.length ?? 0) > 0
  const durationText = input.duration && (hasPain || hasSymptoms) ? durationSentence(input.duration, hasPain) : ''
  if (hasPain && durationText) out.push(durationText)

  const feelAssets = dedupe(input.feel ?? []).flatMap((id) => byId(id) ?? [])
  const have = feelAssets.filter((a) => a.phrase).map((a) => a.phrase as string)
  const otherFeel = feelAssets.filter((a) => !a.phrase).map((a) => a.sentence)
  const eventAssets = dedupe(input.events ?? []).flatMap((id) => byId(id) ?? [])
  const eventClauses = eventAssets.map((a) => a.sentence)

  if (have.length) out.push(`I ${hasPain ? 'also ' : ''}have ${listJoin(have)}.`)

  const clauses = [...eventClauses, ...otherFeel]
  const iClauses = clauses.filter((c) => c.startsWith('I ')).map(stripI)
  const other = clauses.filter((c) => !c.startsWith('I '))
  if (iClauses.length) out.push(`I ${listJoin(iClauses)}.`)
  for (const o of other) out.push(`${o}.`)

  if (!hasPain && durationText) out.push(durationText)

  const feelingAssets = dedupe(input.feelings ?? []).flatMap((id) => byId(id) ?? [])
  const feelWords = feelingAssets.filter((a) => a.sentence.startsWith('I feel ')).map((a) => a.sentence.slice(7))
  const standalone = feelingAssets.filter((a) => !a.sentence.startsWith('I feel ')).map((a) => `${a.sentence}.`)
  if (feelWords.length) out.push(`I feel ${listJoin(feelWords)}.`)
  out.push(...standalone)

  for (const n of input.notes ?? []) out.push(/[.?!]$/.test(n) ? n : `${n}.`)

  return out.join(' ')
}
