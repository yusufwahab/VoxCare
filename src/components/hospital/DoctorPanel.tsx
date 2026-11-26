import { useState, type ReactNode } from 'react'
import { Check, Flag, Hand, Loader2, Maximize2, MessageSquareText, Send, Volume2, X } from 'lucide-react'
import { MiniBody } from '../BodyMap'
import { Badge, Eyebrow, cx } from '../ui'
import { byId, INSTRUCTIONS, QUESTIONS, type Asset } from '../../data/assets'
import { sentenceFrom, useVisit } from '../../visit/store'
import { speak } from '../../lib/speech'
import { useStaff } from '../../store/device'

type Tab = 'says' | 'ask' | 'instruct' | 'summary'
const TABS: { id: Tab; label: string }[] = [
  { id: 'says', label: 'Patient says' },
  { id: 'ask', label: 'Ask' },
  { id: 'instruct', label: 'Instruct' },
  { id: 'summary', label: 'Summary' },
]

const label = 'font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted'

function Thumb({ a }: { a: Asset }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-semibold">
      <img src={a.poster ?? a.src} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
      {a.doctorText}
    </span>
  )
}

/** The doctor's controls. layout "stack" shows everything in one column (shared tablet); "tabs" is the phone layout. */
export function DoctorPanel({ onEnd, layout = 'stack', toolbar }: { onEnd: () => void; layout?: 'stack' | 'tabs'; toolbar?: ReactNode }) {
  const v = useVisit()
  const doctor = useStaff((s) => s.doctor)
  const [tab, setTab] = useState<Tab>('says')
  const show = (t: Tab) => layout === 'stack' || tab === t

  return (
    <div className="flex h-full flex-col gap-5 p-5 sm:p-7">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Eyebrow>Doctor panel</Eyebrow>
          <p className="mt-2 truncate text-sm font-semibold text-muted">{doctor?.name} · {v.patientName ?? 'Walk-in visit'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <button onClick={onEnd} className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 text-sm font-semibold text-ivory">
            <Flag size={16} aria-hidden /> End visit
          </button>
        </div>
      </header>

      {layout === 'tabs' && (
        <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-full bg-sand p-1 [scrollbar-width:none]" role="tablist" aria-label="Doctor sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cx('min-h-11 flex-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors sm:text-sm', tab === t.id ? 'bg-ink text-ivory' : 'text-muted')}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {show('says') && <Says />}
      {show('ask') && <Ask />}
      {show('instruct') && <Instruct />}
      {(show('summary') && layout === 'tabs') && <Summary />}
      {layout === 'stack' && v.answers.length > 1 && <AllAnswers />}
    </div>
  )
}

function Says() {
  const v = useVisit()
  const draft = sentenceFrom(v)
  const picked = [...v.feel, ...v.events, ...v.feelings].map(byId).filter(Boolean) as Asset[]
  const livePins = v.pins
  const backPins = livePins.some((p) => p.view === 'back')
  const frontPins = livePins.some((p) => p.view === 'front') || !backPins
  const choosing = draft !== '' && draft !== v.submitted
  const last = v.answers.at(-1)
  const waiting = v.shown

  return (
    <>
      <section className="rounded-[20px] border border-line bg-white p-5 shadow-soft" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={label}>The patient says</span>
          {v.submitted && (
            <div className="flex gap-2">
              <button onClick={() => v.set({ sentenceOpen: true })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 font-semibold">
                <Maximize2 size={18} aria-hidden /> Show large
              </button>
              <button onClick={() => speak(v.submitted!)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-4 font-semibold text-ink">
                <Volume2 size={18} aria-hidden /> Speak
              </button>
            </div>
          )}
        </div>

        {v.submitted && <p className="text-[clamp(1.4rem,2.4vw,2rem)] font-semibold leading-snug tracking-tight">{v.submitted}</p>}
        {choosing && (
          <div className={cx(v.submitted && 'mt-4 border-t border-line pt-4')}>
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted"><Loader2 size={14} className="animate-spin" aria-hidden /> Patient is choosing</p>
            <p className="text-xl font-semibold leading-snug tracking-tight text-ink/60">{draft}</p>
          </div>
        )}
        {!v.submitted && !choosing && <p className="text-lg text-muted">Waiting for the patient. They choose pictures, then press Done.</p>}

        {(livePins.length > 0 || picked.length > 0 || v.notes.length > 0) && (
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {frontPins && livePins.length > 0 && <MiniBody pins={livePins} view="front" height="170px" />}
            {backPins && <MiniBody pins={livePins} view="back" height="170px" />}
            <div className="flex flex-1 flex-wrap gap-2">
              {picked.map((a) => <Thumb key={a.id} a={a} />)}
              {v.notes.map((n) => <span key={n.id} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">{n.label}</span>)}
            </div>
          </div>
        )}
      </section>

      {waiting && <Waiting />}
      {!waiting && last && <AnswerCard answer={last} />}

      {v.pictureRequested && (
        <section className="rounded-[20px] bg-self-bg p-4"><Badge kind="self">Patient asks</Badge><p className="mt-1 font-semibold">The patient would like a picture instead. Choose a question or instruction.</p></section>
      )}
    </>
  )
}

/** After a question or instruction is sent */
function Waiting() {
  const shown = useVisit((s) => s.shown)
  if (!shown) return null
  const text =
    shown.type === 'question' ? (QUESTIONS.find((q) => q.id === shown.id)?.doctorText ?? 'Question')
    : shown.type === 'instruction' ? (INSTRUCTIONS.find((i) => i.id === shown.id)?.doctorText ?? 'Instruction')
    : shown.type === 'gestures' ? 'Hand signs' : shown.text
  return (
    <section className="flex items-center gap-4 rounded-[20px] bg-sand p-5" role="status">
      <Loader2 className="shrink-0 animate-spin text-ember" aria-hidden />
      <div>
        <p className="font-semibold">Waiting for answer…</p>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </section>
  )
}

/** The patient's reply as a big card: YES, NO, or Understood with a tick */
function AnswerCard({ answer }: { answer: { question: string; answer: string } }) {
  const understood = answer.answer === 'Understood'
  const yes = /^yes/i.test(answer.answer)
  const no = /^no\b/i.test(answer.answer)
  if (!yes && !no && !understood) {
    return (
      <section className="rounded-[20px] bg-sand p-5">
        <span className={label}>Latest answer</span>
        <p className="mt-1 text-sm text-muted">{answer.question}</p>
        <p className="text-xl font-semibold">{answer.answer}</p>
      </section>
    )
  }
  return (
    <section className={cx('flex items-center gap-4 rounded-[20px] p-5 text-white', no ? 'bg-alert' : 'bg-verified')} role="status">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20">{no ? <X size={32} strokeWidth={3.2} aria-hidden /> : <Check size={32} strokeWidth={3.2} aria-hidden />}</span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[clamp(1.5rem,7.5vw,2.25rem)] font-semibold leading-none tracking-tight">{understood ? 'UNDERSTOOD' : no ? 'NO' : 'YES'}</p>
        <p className="mt-1 text-sm text-white/85">{answer.question}</p>
        {!understood && <p className="text-base font-semibold">{answer.answer}</p>}
      </div>
    </section>
  )
}

function Ask() {
  const v = useVisit()
  const [text, setText] = useState('')
  const ask = (q: Asset) => v.dispatch({ type: 'doctor.question', questionId: q.id })
  const sendText = () => {
    const t = text.trim()
    if (!t) return
    v.dispatch({ type: 'doctor.text', text: t })
    setText('')
  }
  return (
    <>
      <section>
        <h3 className="mb-3 font-semibold">Ask with pictures</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {QUESTIONS.map((q) => (
            <button key={q.id} onClick={() => ask(q)} className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-2 pr-3 text-left transition-colors hover:bg-sand">
              <img src={q.src} alt="" width={64} height={64} loading="lazy" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
              <span className="text-sm font-semibold leading-tight">{q.doctorText}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquareText size={18} aria-hidden /> Write for the patient (optional)</h3>
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()} placeholder="Type a short message" className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-5 outline-none focus:border-ember" />
          <button onClick={sendText} aria-label="Show on patient screen" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ember text-ink"><Send size={18} aria-hidden /></button>
        </div>
      </section>
    </>
  )
}

function Instruct() {
  const v = useVisit()
  return (
    <section>
      <h3 className="mb-3 font-semibold">Instructions</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {INSTRUCTIONS.map((i) => (
          <button key={i.id} onClick={() => v.dispatch({ type: 'doctor.instruction', instructionId: i.id })} className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-2 pr-3 text-left transition-colors hover:bg-sand">
            <img src={i.src} alt="" width={64} height={64} loading="lazy" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
            <span className="text-sm font-semibold leading-tight">{i.doctorText}</span>
          </button>
        ))}
        <button onClick={() => v.dispatch({ type: 'doctor.gestures' })} className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-2 pr-3 text-left hover:bg-sand">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cocoa text-ivory"><Hand aria-hidden /></span>
          <span className="text-sm font-semibold">Show hand signs</span>
        </button>
      </div>
      {v.shown && <div className="mt-4"><Waiting /></div>}
      {!v.shown && v.answers.at(-1)?.answer === 'Understood' && <div className="mt-4"><AnswerCard answer={v.answers.at(-1)!} /></div>}
    </section>
  )
}

function AllAnswers() {
  const answers = useVisit((s) => s.answers)
  return (
    <section>
      <h3 className="mb-2 font-semibold">All answers</h3>
      <ul className="space-y-2 text-sm">{answers.map((a, i) => <li key={i} className="rounded-2xl bg-white px-4 py-2"><span className="text-muted">{a.question}</span><br /><b>{a.answer}</b></li>)}</ul>
    </section>
  )
}

function Summary() {
  const summary = useVisit((s) => s.summary)
  return (
    <section>
      <h3 className="mb-3 font-semibold">Everything so far</h3>
      {summary.length === 0 ? <p className="text-muted">Nothing yet.</p> : (
        <ol className="space-y-2">
          {summary.map((t, i) => (
            <li key={i} className={cx('rounded-[20px] p-4', t.who === 'patient' ? 'bg-white shadow-soft' : 'bg-sand')}>
              <span className={label}>{t.who === 'patient' ? 'Patient' : 'Doctor'}</span>
              <p className="mt-0.5 font-semibold leading-snug">{t.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
