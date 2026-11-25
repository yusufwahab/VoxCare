import { describe, expect, it } from 'vitest'
import * as server from '../api/_lib/briefingText.js'
import * as browser from '../src/lib/briefingText.js'
import { briefingText } from './briefingText.js'

const f = (type: string, value: string) => ({ type, value, status: 'doctor_verified' })

describe('briefing text', () => {
  it('the browser and the server use the very same functions', () => {
    expect(browser.briefingText).toBe(server.briefingText)
    expect(browser.phraseFact).toBe(server.phraseFact)
  })

  it('says every medical fact, with an instruction for allergies', () => {
    const t = briefingText('Ada', [f('allergy', 'Penicillin'), f('blood_group', 'O+'), f('medicine', 'Salbutamol'), f('condition', 'Asthma'), f('body_fact', 'uses a wheelchair')], [f('condition', 'Fainting'), f('allergy', 'Latex'), f('condition', 'Migraine')])
    expect(t).toBe(
      'Emergency information for Ada. This person is Deaf and cannot speak. They cannot hear you. Face them, use gestures, and show them the pictures on this screen. ' +
      'Do not shout, and do not assume they are unconscious because they do not respond to sound. Their family has already been alerted. ' +
      'Doctor-verified information: They are allergic to penicillin. Do not give penicillin. Their blood group is O+. They take salbutamol. They have asthma. Uses a wheelchair. ' +
      'Not yet confirmed by a doctor: fainting, latex and migraine. Press the green button on screen to call their family.',
    )
  })

  it('works with no name and no facts', () => {
    const t = briefingText(null, [], [])
    expect(t).toContain('Emergency information for the owner of this phone.')
    expect(t).not.toContain('Doctor-verified')
    expect(t).not.toContain('Not yet confirmed')
  })
})
