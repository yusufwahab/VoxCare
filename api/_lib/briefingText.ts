// Keep in sync with src/lib/briefingText.ts (the server cannot import from src)
export interface FactRow {
  id?: string
  type: string
  value: string
  status: string
}

const listJoin = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

export function phraseFact(f: FactRow): string {
  const v = f.value.toLowerCase()
  switch (f.type) {
    case 'allergy': return `They are allergic to ${v}. Do not give ${v}.`
    case 'blood_group': return `Their blood group is ${f.value}.`
    case 'medicine': return `They take ${v}.`
    case 'condition': return `They have ${v}.`
    default: return `${f.value.charAt(0).toUpperCase()}${f.value.slice(1)}.`
  }
}

export function briefingText(name: string | null, verified: FactRow[], unverified: FactRow[]): string {
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
