import { describe, expect, it } from 'vitest'
import { buildSentence } from './sentence'
import { detectRegion, REGIONS, regionPhrase } from './regions'

const knee = { phrase: 'my right knee', kind: 'sharp' as const }

describe('buildSentence', () => {
  it('1. single pain with kind', () => {
    expect(buildSentence({ pains: [knee] })).toBe('I have a sharp pain in my right knee.')
  })
  it('2. pain without kind', () => {
    expect(buildSentence({ pains: [{ phrase: 'my chest' }] })).toBe('I have pain in my chest.')
  })
  it('3. pain with severity', () => {
    expect(buildSentence({ pains: [knee], level: 3 })).toBe('I have a sharp pain in my right knee. It is very bad.')
  })
  it('4. pain with days', () => {
    expect(buildSentence({ pains: [knee], duration: { type: 'days', n: 3 } })).toBe(
      'I have a sharp pain in my right knee. It started 3 days ago.',
    )
  })
  it('5. the headline example', () => {
    expect(
      buildSentence({
        pains: [knee],
        level: 3,
        duration: { type: 'days', n: 3 },
        feel: ['fever'],
        events: ['dizzy'],
      }),
    ).toBe(
      'I have a sharp pain in my right knee. It is very bad. It started 3 days ago. I also have a fever. I feel dizzy.',
    )
  })
  it('6. yesterday and today', () => {
    expect(buildSentence({ pains: [knee], duration: { type: 'days', n: 1 } })).toContain('yesterday')
    expect(buildSentence({ pains: [knee], duration: { type: 'days', n: 0 } })).toContain('started today')
  })
  it('7. preset durations', () => {
    expect(buildSentence({ pains: [knee], duration: { type: 'preset', key: 'few' } })).toContain('a few days ago')
    expect(buildSentence({ pains: [knee], duration: { type: 'preset', key: 'week' } })).toContain('about a week ago')
    expect(buildSentence({ pains: [knee], duration: { type: 'preset', key: 'longer' } })).toContain('more than a week ago')
  })
  it('8. weeks', () => {
    expect(buildSentence({ pains: [knee], duration: { type: 'days', n: 14 } })).toContain('2 weeks ago')
    expect(buildSentence({ pains: [knee], duration: { type: 'days', n: 7 } })).toContain('a week ago')
  })
  it('9. two pains of the same kind are grouped', () => {
    expect(
      buildSentence({ pains: [knee, { phrase: 'my left knee', kind: 'sharp' }] }),
    ).toBe('I have a sharp pain in my right knee and my left knee.')
  })
  it('10. two pains of different kinds', () => {
    expect(buildSentence({ pains: [knee, { phrase: 'my chest', kind: 'burning' }] })).toBe(
      'I have a sharp pain in my right knee and a burning pain in my chest.',
    )
  })
  it('11. three pains read naturally', () => {
    const s = buildSentence({
      pains: [knee, { phrase: 'my left knee', kind: 'sharp' }, { phrase: 'my chest', kind: 'burning' }],
    })
    expect(s).toBe('I have a sharp pain in my right knee and my left knee, and a burning pain in my chest.')
  })
  it('12. several things I have are grouped', () => {
    expect(buildSentence({ feel: ['fever', 'chills', 'rash'] })).toBe('I have a fever, chills and a rash.')
  })
  it('13. feel items without pain avoid "also"', () => {
    expect(buildSentence({ feel: ['cough'] })).toBe('I have a cough.')
  })
  it('14. mixed feel verbs', () => {
    expect(buildSentence({ feel: ['fever', 'weak-tired'] })).toBe('I have a fever. I feel weak and tired.')
  })
  it('15. events merge into one sentence', () => {
    expect(buildSentence({ events: ['faint', 'dizzy'] })).toBe('I fainted and feel dizzy.')
  })
  it('16. three events', () => {
    expect(buildSentence({ events: ['fall', 'faint', 'vomit'] })).toBe('I fell down, fainted and have been vomiting.')
  })
  it('17. clause that does not start with I stays its own sentence', () => {
    expect(buildSentence({ events: ['stroke-signs'] })).toBe('My face and arm feel weak on one side.')
  })
  it('18. feelings merge', () => {
    expect(buildSentence({ feelings: ['worried', 'scared'] })).toBe('I feel worried and scared.')
  })
  it('19. not safe stays standalone', () => {
    expect(buildSentence({ feelings: ['sad', 'unsafe'] })).toBe('I feel sad. I do not feel safe.')
  })
  it('20. notes are appended with a full stop', () => {
    expect(buildSentence({ notes: ['I am allergic to a medicine'] })).toBe('I am allergic to a medicine.')
  })
  it('21. duration alone is ignored when nothing else is chosen', () => {
    expect(buildSentence({ duration: { type: 'days', n: 3 } })).toBe('')
  })
  it('22. duration with symptoms but no pain uses "This"', () => {
    expect(buildSentence({ feel: ['fever'], duration: { type: 'days', n: 2 } })).toBe(
      'I have a fever. This started 2 days ago.',
    )
  })
  it('23. duplicates are removed', () => {
    expect(buildSentence({ feel: ['fever', 'fever'] })).toBe('I have a fever.')
  })
  it('24. worst pain', () => {
    expect(buildSentence({ pains: [{ phrase: 'my head', kind: 'throbbing' }], level: 4 })).toBe(
      'I have a throbbing pain in my head. It is the worst pain I have had.',
    )
  })
})

describe('body regions', () => {
  it('front: viewer-left knee is the patient\'s right knee', () => {
    expect(detectRegion('front', 43, 71)?.name).toBe('Right knee')
    expect(detectRegion('front', 57, 71)?.name).toBe('Left knee')
  })
  it('back: viewer-left is the patient\'s left', () => {
    expect(detectRegion('back', 43, 71)?.name).toBe('Left knee')
  })
  it('detects the main torso regions', () => {
    expect(detectRegion('front', 50, 30)?.name).toBe('Chest')
    expect(detectRegion('front', 50, 40)?.name).toBe('Upper stomach')
    expect(detectRegion('back', 50, 30)?.name).toBe('Upper back')
    expect(detectRegion('back', 50, 52)?.name).toBe('Buttocks')
  })
  it('head and feet', () => {
    expect(detectRegion('front', 50, 10)?.name).toBe('Head')
    expect(detectRegion('front', 42, 93)?.name).toBe('Right foot')
  })
  it('regionPhrase', () => {
    expect(regionPhrase({ name: 'Right knee' })).toBe('my right knee')
    expect(regionPhrase({ name: 'Chest' })).toBe('my chest')
  })
  it('ankle sits between calf and foot', () => {
    expect(detectRegion('front', 43, 88)?.name).toBe('Right ankle')
    expect(detectRegion('front', 43, 80)?.name).toBe('Right shin')
  })
  it('every polygon is inside the image', () => {
    for (const v of ['front', 'back'] as const)
      for (const r of REGIONS[v]) for (const [x, y] of r.polygon) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(100)
      }
  })
})
