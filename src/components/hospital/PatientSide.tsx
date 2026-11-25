import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Send } from 'lucide-react'
import { BodyMap, type Pin } from '../BodyMap'
import { DurationPicker, LevelPicker, PainKindPicker } from '../PainPickers'
import { AnswerButtons, PictureCard, PillButton } from '../ui'
import { CATEGORIES, EVENTS, FACTS, FEEL, FEELINGS, INSTRUCTIONS, QUESTIONS, UI, type Asset } from '../../data/assets'
import { sentenceFrom, useVisit, type PatientScreen } from '../../visit/store'
import type { Note } from '../../visit/events'
import { regionPhrase } from '../../lib/regions'
import type { Duration } from '../../lib/sentence'

const fade = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.22 } }

/** Turn the body map's new list of pins into events, so only what changed is shared */
function dispatchPinChanges(next: Pin[]) {
  const { pins: old, dispatch } = useVisit.getState()
  const before = new Map(old.map((p) => [p.id, p]))
  for (const p of next) {
    const o = before.get(p.id)
    if (!o) dispatch({ type: 'patient.pin_added', pin: p })
    else if (o.x !== p.x || o.y !== p.y) dispatch({ type: 'patient.pin_moved', pinId: p.id, x: p.x, y: p.y, regionName: p.regionName })
  }
  const keep = new Set(next.map((p) => p.id))
  for (const o of old) if (!keep.has(o.id)) dispatch({ type: 'patient.pin_removed', pinId: o.id })
}

const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

function Title({ children }: { children: string }) {
  return <h2 className="h3 text-center">{children}</h2>
}

function Back({ to }: { to: PatientScreen }) {
  const set = useVisit((s) => s.set)
  return (
    <button onClick={() => set({ screen: to })} aria-label="Back" className="grid h-14 w-14 place-items-center rounded-full bg-sand text-ink">
      <ArrowLeft aria-hidden />
    </button>
  )
}

function Grid({ items, selected, onToggle }: { items: Asset[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((a) => (
        <PictureCard key={a.id} src={a.poster ?? a.src} clip={a.poster ? a.src : undefined} poster={a.poster} label={a.label} size="lg" selected={selected.includes(a.id)} onClick={() => onToggle(a.id)} />
      ))}
    </div>
  )
}

export function PatientSide() {
  const v = useVisit()
  const { screen, set } = v
  const anything = sentenceFrom(v) !== ''
  const pendingKind = v.pins.find((p) => !p.kind)

  const done = () => { v.dispatch({ type: 'patient.done' }); set({ screen: 'menu' }) }

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="flex-1 px-4 pb-36 pt-5 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={screen === 'kind' ? `kind-${pendingKind?.id}` : screen} {...fade} className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6">
            {screen === 'menu' && <Menu />}

            {screen === 'body' && (
              <>
                <div className="flex w-full items-center gap-3"><Back to="menu" /><div className="flex-1"><Title>Where does it hurt?</Title></div><span className="w-14" /></div>
                <BodyMap view={v.view} onViewChange={(view) => set({ view })} pins={v.pins} onPinsChange={dispatchPinChanges} height="min(54vh, 600px)" />
                <PillButton size="lg" disabled={v.pins.length === 0} onClick={() => set({ screen: 'kind' })} icon={<Check size={22} />}>That is it</PillButton>
              </>
            )}

            {screen === 'kind' && pendingKind && (
              <>
                <div className="flex w-full items-center gap-3"><Back to="body" /><div className="flex-1"><Title>What kind of pain?</Title></div><span className="w-14" /></div>
                <p className="-mt-2 text-lg font-semibold text-muted">{pendingKind.regionName}</p>
                <PainKindPicker pin={pendingKind} value={pendingKind.kind} onChange={(k) => {
                  v.dispatch({ type: 'patient.pain_type', pinId: pendingKind.id, kind: k })
                  const remaining = useVisit.getState().pins.some((p) => !p.kind)
                  if (!remaining) set({ screen: 'level' })
                }} />
              </>
            )}
            {screen === 'kind' && !pendingKind && <Advance to="level" />}

            {screen === 'level' && (
              <>
                <div className="flex w-full items-center gap-3"><Back to="body" /><div className="flex-1"><Title>How bad?</Title></div><span className="w-14" /></div>
                <LevelPicker value={v.level} onChange={(n) => { v.dispatch({ type: 'patient.pain_level', level: n }); setTimeout(() => set({ screen: 'howlong' }), 350) }} />
              </>
            )}

            {screen === 'howlong' && (
              <>
                <div className="flex w-full items-center gap-3"><Back to="level" /><div className="flex-1"><Title>How long?</Title></div><span className="w-14" /></div>
                <DurationPicker value={v.duration} onChange={(d) => v.dispatch({ type: 'patient.duration', duration: d })} />
                <PillButton size="lg" disabled={!v.duration} onClick={() => set({ screen: 'menu' })} icon={<Check size={22} />}>OK</PillButton>
              </>
            )}

            {screen === 'feel' && <GridScreen title="How my body feels" items={FEEL} selected={v.feel} onToggle={(id) => v.dispatch({ type: 'patient.selected', group: 'feel', ids: toggleIn(v.feel, id) })} />}
            {screen === 'events' && <GridScreen title="Something happened" items={EVENTS} selected={v.events} onToggle={(id) => v.dispatch({ type: 'patient.selected', group: 'events', ids: toggleIn(v.events, id) })} />}
            {screen === 'feelings' && <GridScreen title="Feelings" items={FEELINGS} selected={v.feelings} onToggle={(id) => v.dispatch({ type: 'patient.selected', group: 'feelings', ids: toggleIn(v.feelings, id) })} />}

            {screen === 'allergy' && (
              <>
                <div className="flex w-full items-center gap-3"><Back to="menu" /><div className="flex-1"><Title>Allergy or medicine</Title></div><span className="w-14" /></div>
                <div className="grid w-full max-w-xl grid-cols-2 gap-6">
                  {[
                    { id: 'note-allergy', src: QUESTIONS.find((q) => q.id === 'q-allergy')!.src, label: 'Allergy', text: 'I am allergic to a medicine' },
                    { id: 'note-medicine', src: QUESTIONS.find((q) => q.id === 'q-medicine')!.src, label: 'I take medicine', text: 'I take medicine every day' },
                  ].map((n) => (
                    <PictureCard key={n.id} size="lg" src={n.src} label={n.label} selected={v.notes.some((x) => x.id === n.id)} onClick={() => toggleNote(v.notes, { id: n.id, text: n.text, label: n.label })} />
                  ))}
                </div>
                <PillButton size="lg" onClick={() => set({ screen: 'menu' })} icon={<Check size={22} />}>OK</PillButton>
              </>
            )}

            {screen === 'other' && <OtherScreen />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Persistent Done bar */}
      <div className="safe-b sticky bottom-0 z-20 mt-auto bg-gradient-to-t from-ivory via-ivory to-transparent px-4 pt-6">
        <div className="mx-auto flex max-w-4xl justify-center">
          <PillButton size="lg" variant="dark" disabled={!anything} onClick={done} icon={<Send size={20} />} className="w-full max-w-md">Done</PillButton>
        </div>
      </div>
    </div>
  )
}

function toggleNote(notes: Note[], n: Note) {
  useVisit.getState().dispatch({ type: 'patient.notes', notes: notes.some((x) => x.id === n.id) ? notes.filter((x) => x.id !== n.id) : [...notes, n] })
}

function Advance({ to }: { to: PatientScreen }) {
  const set = useVisit((s) => s.set)
  return <PillButton size="lg" onClick={() => set({ screen: to })}>Next</PillButton>
}

function GridScreen({ title, items, selected, onToggle }: { title: string; items: Asset[]; selected: string[]; onToggle: (id: string) => void }) {
  const set = useVisit((s) => s.set)
  return (
    <>
      <div className="flex w-full items-center gap-3"><Back to="menu" /><div className="flex-1"><Title>{title}</Title></div><span className="w-14" /></div>
      <Grid items={items} selected={selected} onToggle={onToggle} />
      <PillButton size="lg" onClick={() => set({ screen: 'menu' })} icon={<Check size={22} />}>OK</PillButton>
    </>
  )
}

function Menu() {
  const v = useVisit()
  const set = v.set
  const main: { id: PatientScreen; key: keyof typeof CATEGORIES; count: number }[] = [
    { id: 'body', key: 'pain', count: v.pins.length },
    { id: 'feel', key: 'feel', count: v.feel.length },
    { id: 'events', key: 'events', count: v.events.length },
    { id: 'feelings', key: 'feelings', count: v.feelings.length },
  ]
  const small: { id: PatientScreen; key: keyof typeof CATEGORIES; count: number }[] = [
    { id: 'allergy', key: 'allergy', count: v.notes.filter((n) => n.id.startsWith('note-a') || n.id === 'note-medicine').length },
    { id: 'other', key: 'other', count: v.notes.filter((n) => n.id.startsWith('fact-')).length + (v.typed ? 1 : 0) },
  ]
  return (
    <>
      <Title>What do you want to say?</Title>
      <div className="grid w-full max-w-xl grid-cols-2 gap-5 sm:gap-6">
        {main.map((c) => (
          <PictureCard key={c.id} size="lg" src={CATEGORIES[c.key].src} label={CATEGORIES[c.key].label} selected={c.count > 0} onClick={() => set({ screen: c.id })} />
        ))}
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-5">
        {small.map((c) => (
          <PictureCard key={c.id} size="md" src={CATEGORIES[c.key].src} label={CATEGORIES[c.key].label} selected={c.count > 0} onClick={() => set({ screen: c.id })} />
        ))}
      </div>
      {v.pins.length > 0 && v.level === undefined && (
        <p className="text-sm font-semibold text-muted">{regionPhrase({ name: v.pins[0].regionName })}</p>
      )}
    </>
  )
}

function OtherScreen() {
  const v = useVisit()
  const [typed, setTyped] = useState(v.typed)
  const send = () => { if (typed !== useVisit.getState().typed) v.dispatch({ type: 'patient.typed', text: typed }) }
  return (
    <>
      <div className="flex w-full items-center gap-3"><Back to="menu" /><div className="flex-1"><Title>About me</Title></div><span className="w-14" /></div>
      <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
        {FACTS.map((a) => (
          <PictureCard key={a.id} size="lg" src={a.src} label={a.label} selected={v.notes.some((n) => n.id === `fact-${a.id}`)} onClick={() => toggleNote(v.notes, { id: `fact-${a.id}`, text: a.sentence, label: a.label })} />
        ))}
      </div>
      <label className="w-full max-w-md text-sm font-semibold text-muted">
        Type something (optional)
        <input value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={send} className="mt-1 w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink outline-none focus:border-ember" />
      </label>
      <PillButton size="lg" onClick={() => { send(); v.set({ screen: 'menu' }) }} icon={<Check size={22} />}>OK</PillButton>
    </>
  )
}

/** Doctor-pushed full screen content on the patient's side */
export function ShownOverlay() {
  const v = useVisit()
  const { shown, set } = v
  const [howLong, setHowLong] = useState<Duration | undefined>()
  const close = () => setHowLong(undefined)

  if (!shown) return null
  const answer = (questionId: string, value: 'yes' | 'no') => { v.dispatch({ type: 'patient.answer', questionId, value }); close() }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-ivory p-6" role="dialog" aria-modal="true">
      {shown.type === 'question' && shown.id === 'q-where' && (
        <>
          <Title>Where does it hurt?</Title>
          <BodyMap view={v.view} onViewChange={(view) => set({ view })} pins={v.pins} onPinsChange={dispatchPinChanges} height="min(50vh, 560px)" />
          <PillButton size="lg" disabled={v.pins.length === 0} onClick={() => { v.dispatch({ type: 'patient.answer', questionId: 'q-where', value: { kind: 'where', pins: v.pins } }); close() }} icon={<Check size={22} />}>That is it</PillButton>
        </>
      )}

      {shown.type === 'question' && shown.id !== 'q-where' && (() => {
        const q = QUESTIONS.find((x) => x.id === shown.id)!
        return (
          <>
            <img src={q.src} alt={q.doctorText} width={900} height={900} className="max-h-[52vh] w-auto max-w-full rounded-[28px] object-contain shadow-soft" />
            {q.id === 'q-how-long' ? (
              <>
                <DurationPicker value={howLong} onChange={setHowLong} />
                <PillButton size="lg" disabled={!howLong} onClick={() => { if (howLong) { v.dispatch({ type: 'patient.answer', questionId: q.id, value: { kind: 'duration', duration: howLong } }); close() } }} icon={<Check size={22} />}>OK</PillButton>
              </>
            ) : (
              <AnswerButtons yesLabel="Yes" noLabel="No" onYes={() => answer(q.id, 'yes')} onNo={() => answer(q.id, 'no')} />
            )}
          </>
        )
      })()}

      {shown.type === 'instruction' && (() => {
        const i = INSTRUCTIONS.find((x) => x.id === shown.id)!
        return (
          <>
            <img src={i.src} alt={i.doctorText} width={900} height={900} className="max-h-[52vh] w-auto max-w-full rounded-[28px] object-contain shadow-soft" />
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => v.dispatch({ type: 'patient.ack', instructionId: i.id })} aria-label="I understand" className="flex flex-col items-center gap-3">
              <span className="relative grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-verified shadow-lift">
                <img src={UI.consent} alt="" width={144} height={144} className="h-full w-full object-cover opacity-90" />
                <span className="absolute inset-0 grid place-items-center bg-verified/55"><Check size={72} strokeWidth={3.2} className="text-white" aria-hidden /></span>
              </span>
              <span className="text-lg font-semibold text-verified">I understand</span>
            </motion.button>
          </>
        )
      })()}

      {shown.type === 'gestures' && (
        <>
          <img src={UI.doctorGestures} alt="Doctor hand signs" width={1000} height={1000} className="max-h-[62vh] w-auto max-w-full rounded-[28px] object-contain shadow-soft" />
          <PillButton size="lg" onClick={() => v.dispatch({ type: 'patient.ack', instructionId: 'gestures' })} icon={<Check size={22} />}>OK</PillButton>
        </>
      )}

      {shown.type === 'text' && (
        <>
          <p className="max-w-3xl text-center text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-tight tracking-tight">{shown.text}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <PillButton size="lg" onClick={() => v.dispatch({ type: 'patient.ack', instructionId: 'text' })} icon={<Check size={22} />}>OK</PillButton>
            <PillButton size="lg" variant="outline" noIcon onClick={() => v.dispatch({ type: 'patient.picture_requested' })}>Show me a picture instead</PillButton>
          </div>
        </>
      )}
    </motion.div>
  )
}
