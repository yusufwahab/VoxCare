import type { Fact } from './types'
import { listJoin } from './sentence'

/** Phrase one fact for the spoken briefing. Allergies get an explicit instruction. */
export function phraseFact(f: Fact): string {
  switch (f.type) {
    case 'allergy':
      return `They are allergic to ${f.value.toLowerCase()}. Do not give ${f.value.toLowerCase()}.`
    case 'blood_group':
      return `Their blood group is ${f.value}.`
    case 'medicine':
      return `They take ${f.value.toLowerCase()}.`
    case 'condition':
      return `They have ${f.value.toLowerCase()}.`
    default:
      return `${f.value.charAt(0).toUpperCase()}${f.value.slice(1)}.`
  }
}

/** English briefing template. The same text is sent to YarnGPT for the other languages. */
export function briefingText(name: string | null, verified: Fact[], unverified: Fact[]): string {
  const who = name?.trim() || 'the owner of this phone'
  const parts = [
    `Emergency information for ${who}.`,
    'This person is Deaf and cannot speak. They cannot hear you.',
    'Face them, use gestures, and show them the pictures on this screen.',
    'Do not shout, and do not assume they are unconscious because they do not respond to sound.',
    'Their family has already been alerted.',
  ]
  if (verified.length) parts.push(`Doctor-verified information: ${verified.map(phraseFact).join(' ')}`)
  if (unverified.length) parts.push(`Not yet confirmed by a doctor: ${listJoin(unverified.map((f) => f.value.toLowerCase()))}.`)
  parts.push('Press the green button on screen to call their family.')
  return parts.join(' ')
}
