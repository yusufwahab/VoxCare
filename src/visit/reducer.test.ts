import { describe, expect, it } from 'vitest'
import { initialCore, replay, sentenceFrom, visitReducer } from './reducer'
import { stamp, type Payload, type Pin, type VisitEvent } from './events'

const pin: Pin = { id: 'p1', view: 'front', x: 43, y: 71, regionName: 'Right knee' }
const patient = (p: Payload) => stamp(p, 'patient')
const doctor = (p: Payload) => stamp(p, 'doctor')

const session = (): VisitEvent[] => [
  patient({ type: 'visit.patient_joined' }),
  patient({ type: 'patient.pin_added', pin }),
  patient({ type: 'patient.pain_type', pinId: 'p1', kind: 'sharp' }),
  patient({ type: 'patient.pain_level', level: 3 }),
  patient({ type: 'patient.duration', duration: { type: 'days', n: 3 } }),
  patient({ type: 'patient.selected', group: 'feel', ids: ['fever'] }),
  patient({ type: 'patient.done' }),
]

describe('visitReducer', () => {
  it('builds the sentence from events and stores it on Done', () => {
    const s = replay(session())
    expect(s.patientJoined).toBe(true)
    expect(s.submitted).toBe('I have a sharp pain in my right knee. It is very bad. It started 3 days ago. I also have a fever.')
    expect(s.submittedPins).toHaveLength(1)
    expect(s.summary[0]).toMatchObject({ who: 'patient', kind: 'statement' })
  })

  it('replaying the same events always gives the same state', () => {
    const events = session()
    expect(replay(events)).toEqual(replay(events))
  })

  it('ignores an event it has already applied (network echo, replay after reconnect)', () => {
    const events = session()
    const once = replay(events)
    expect(replay(events, once)).toEqual(once)
    const e = events[1]
    expect(visitReducer(once, e)).toBe(once)
  })

  it('catches up: replaying all events on top of a partial state ends in the same place', () => {
    const events = session()
    const partial = replay(events.slice(0, 3))
    expect(replay(events, partial)).toEqual(replay(events))
  })

  it('moves and removes pins', () => {
    let s = replay([patient({ type: 'patient.pin_added', pin })])
    s = visitReducer(s, patient({ type: 'patient.pin_moved', pinId: 'p1', x: 57, y: 71, regionName: 'Left knee' }))
    expect(s.pins[0]).toMatchObject({ x: 57, regionName: 'Left knee' })
    s = visitReducer(s, patient({ type: 'patient.pin_removed', pinId: 'p1' }))
    expect(s.pins).toHaveLength(0)
  })

  it('does not add the same pin twice', () => {
    const s = replay([patient({ type: 'patient.pin_added', pin }), patient({ type: 'patient.pin_added', pin })])
    expect(s.pins).toHaveLength(1)
  })

  it('Done with nothing chosen does nothing', () => {
    const s = replay([patient({ type: 'patient.done' })])
    expect(s.submitted).toBeNull()
    expect(s.summary).toHaveLength(0)
  })

  it('doctor question, then tick: answer is recorded and the question is cleared', () => {
    let s = replay([doctor({ type: 'doctor.question', questionId: 'q-allergy' })])
    expect(s.shown).toEqual({ type: 'question', id: 'q-allergy' })
    s = visitReducer(s, patient({ type: 'patient.answer', questionId: 'q-allergy', value: 'yes' }))
    expect(s.shown).toBeNull()
    expect(s.answers.at(-1)?.answer).toBe('Yes, I am allergic to a medicine.')
    expect(s.summary.map((l) => l.who)).toEqual(['doctor', 'patient'])
  })

  it('a cross gives the "No" sentence', () => {
    const s = replay([doctor({ type: 'doctor.question', questionId: 'q-pregnant' }), patient({ type: 'patient.answer', questionId: 'q-pregnant', value: 'no' })])
    expect(s.answers[0].answer).toBe('No, I am not pregnant.')
  })

  it('where does it hurt: answer comes from the pins in the event', () => {
    const s = replay([doctor({ type: 'doctor.question', questionId: 'q-where' }), patient({ type: 'patient.answer', questionId: 'q-where', value: { kind: 'where', pins: [pin] } })])
    expect(s.answers[0].answer).toBe('It hurts at: right knee')
  })

  it('how long: answer is the duration sentence', () => {
    const s = replay([doctor({ type: 'doctor.question', questionId: 'q-how-long' }), patient({ type: 'patient.answer', questionId: 'q-how-long', value: { kind: 'duration', duration: { type: 'days', n: 2 } } })])
    expect(s.answers[0].answer).toBe('It started 2 days ago.')
  })

  it('instruction, then acknowledgement', () => {
    let s = replay([doctor({ type: 'doctor.instruction', instructionId: 'i-xray' })])
    expect(s.shown).toEqual({ type: 'instruction', id: 'i-xray' })
    s = visitReducer(s, patient({ type: 'patient.ack', instructionId: 'i-xray' }))
    expect(s.shown).toBeNull()
    expect(s.answers[0]).toMatchObject({ question: 'You need an X-ray.', answer: 'Understood' })
  })

  it('doctor text can be acknowledged, or the patient can ask for a picture', () => {
    let s = replay([doctor({ type: 'doctor.text', text: 'Lie down' }), patient({ type: 'patient.ack', instructionId: 'text' })])
    expect(s.answers[0]).toMatchObject({ question: 'Lie down', answer: 'Understood' })
    s = replay([doctor({ type: 'doctor.text', text: 'Lie down' }), patient({ type: 'patient.picture_requested' })])
    expect(s.pictureRequested).toBe(true)
    expect(s.shown).toBeNull()
  })

  it('hand signs are acknowledged', () => {
    const s = replay([doctor({ type: 'doctor.gestures' }), patient({ type: 'patient.ack', instructionId: 'gestures' })])
    expect(s.answers[0].question).toBe('Hand signs')
  })

  it('switching mode keeps everything that was already said', () => {
    const before = replay(session())
    const after = visitReducer(before, doctor({ type: 'visit.mode_changed', mode: 'two' }))
    expect(after.mode).toBe('two')
    expect({ ...after, mode: 'one' }).toEqual({ ...before, mode: 'one', seen: after.seen })
    const back = visitReducer(after, patient({ type: 'visit.mode_changed', mode: 'one' }))
    expect(back.mode).toBe('one')
    expect(back.submitted).toBe(before.submitted)
    expect(back.pins).toEqual(before.pins)
  })

  it('a visit can end', () => {
    expect(replay([doctor({ type: 'visit.ended' })]).ended).toBe(true)
  })

  it('live sentence matches what Done will store', () => {
    const live = replay(session().slice(0, -1))
    expect(sentenceFrom(live)).toBe(replay(session()).submitted ?? 'x')
  })

  it('notes and typed text reach the sentence', () => {
    const s = replay([
      patient({ type: 'patient.notes', notes: [{ id: 'fact-pregnant', text: 'I am pregnant', label: 'Pregnant' }] }),
      patient({ type: 'patient.typed', text: 'My leg is numb' }),
      patient({ type: 'patient.done' }),
    ])
    expect(s.submitted).toBe('I am pregnant. My leg is numb.')
  })

  it('starts empty', () => {
    expect(initialCore().pins).toEqual([])
    expect(initialCore('two').mode).toBe('two')
  })
})
