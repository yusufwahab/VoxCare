import { useState } from 'react'
import { Hand, MessageSquareText, Send, Volume2, Flag } from 'lucide-react'
import { MiniBody } from '../BodyMap'
import { Badge, Eyebrow } from '../ui'
import { byId, INSTRUCTIONS, QUESTIONS, type Asset } from '../../data/assets'
import { useVisit } from '../../store/visit'
import { speak } from '../../lib/speech'
import { useStaff } from '../../store/device'

function Thumb({ a }: { a: Asset }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-semibold">
      <img src={a.poster ?? a.src} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
      {a.doctorText}
    </span>
  )
}

export function DoctorPanel({ onEnd }: { onEnd: () => void }) {
  const v = useVisit()
  const doctor = useStaff((s) => s.doctor)
  const [text, setText] = useState('')
  const picked = [...v.feel, ...v.events, ...v.feelings].map(byId).filter(Boolean) as Asset[]
  const backPins = v.submittedPins.some((p) => p.view === 'back')
  const frontPins = v.submittedPins.some((p) => p.view === 'front')

  const ask = (q: Asset) => {
    v.set({ shown: q.id === 'q-where' ? { type: 'where' } : { type: 'question', id: q.id }, pictureRequested: false })
    v.log({ who: 'doctor', kind: 'question', text: q.doctorText })
    speak(q.doctorText)
  }
  const instruct = (i: Asset) => {
    v.set({ shown: { type: 'instruction', id: i.id } })
    v.log({ who: 'doctor', kind: 'instruction', text: i.doctorText })
    speak(i.doctorText)
  }
  const sendText = () => {
    const t = text.trim()
    if (!t) return
    v.set({ shown: { type: 'text', text: t }, pictureRequested: false })
    v.log({ who: 'doctor', kind: 'note', text: t })
    setText('')
  }

  const lastAnswer = v.answers[v.answers.length - 1]

  return (
    <div className="flex h-full flex-col gap-6 p-5 sm:p-7">
      <header className="flex items-center justify-between gap-3">
        <div>
          <Eyebrow>Doctor panel</Eyebrow>
          <p className="mt-2 text-sm font-semibold text-muted">{doctor?.name} · {v.patientName ?? 'Walk-in visit'}</p>
        </div>
        <button onClick={onEnd} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-ivory">
          <Flag size={18} aria-hidden /> End visit
        </button>
      </header>

      {/* Patient sentence */}
      <section className="rounded-[20px] border border-line bg-white p-5 shadow-soft" aria-live="polite">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">The patient says</span>
          {v.submitted && (
            <button onClick={() => speak(v.submitted!)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ember px-4 font-semibold text-ink">
              <Volume2 size={18} aria-hidden /> Speak
            </button>
          )}
        </div>
        {v.submitted ? (
          <p className="text-[clamp(1.4rem,2.4vw,2rem)] font-semibold leading-snug tracking-tight">{v.submitted}</p>
        ) : (
          <p className="text-lg text-muted">Waiting for the patient. They choose pictures, then press Done.</p>
        )}
        {(picked.length > 0 || v.submittedPins.length > 0) && v.submitted && (
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {frontPins && <MiniBody pins={v.submittedPins} view="front" height="170px" />}
            {backPins && <MiniBody pins={v.submittedPins} view="back" height="170px" />}
            <div className="flex flex-1 flex-wrap gap-2">{picked.map((a) => <Thumb key={a.id} a={a} />)}{v.notes.map((n) => <span key={n.id} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">{n.label}</span>)}</div>
          </div>
        )}
      </section>

      {lastAnswer && (
        <section className="rounded-[20px] bg-sand p-5">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Latest answer</span>
          <p className="mt-1 text-sm text-muted">{lastAnswer.question}</p>
          <p className="text-xl font-semibold">{lastAnswer.answer}</p>
        </section>
      )}
      {v.pictureRequested && (
        <section className="rounded-[20px] bg-self-bg p-4"><Badge kind="self">Patient asks</Badge><p className="mt-1 font-semibold">The patient would like a picture instead. Choose a question or instruction below.</p></section>
      )}

      {/* Ask with pictures */}
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
        <h3 className="mb-3 font-semibold">Instructions</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {INSTRUCTIONS.map((i) => (
            <button key={i.id} onClick={() => instruct(i)} className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-2 pr-3 text-left transition-colors hover:bg-sand">
              <img src={i.src} alt="" width={64} height={64} loading="lazy" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
              <span className="text-sm font-semibold leading-tight">{i.doctorText}</span>
            </button>
          ))}
          <button onClick={() => { v.set({ shown: { type: 'gestures' } }); v.log({ who: 'doctor', kind: 'instruction', text: 'Showed hand signs' }) }} className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-2 pr-3 text-left hover:bg-sand">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cocoa text-ivory"><Hand aria-hidden /></span>
            <span className="text-sm font-semibold">Show hand signs</span>
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquareText size={18} aria-hidden /> Write for the patient (optional)</h3>
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()} placeholder="Type a short message" className="min-h-12 flex-1 rounded-full border border-line bg-white px-5 outline-none focus:border-ember" />
          <button onClick={sendText} aria-label="Show on patient screen" className="grid h-12 w-12 place-items-center rounded-full bg-ember text-ink"><Send size={18} aria-hidden /></button>
        </div>
      </section>

      {v.answers.length > 1 && (
        <section>
          <h3 className="mb-2 font-semibold">All answers</h3>
          <ul className="space-y-2 text-sm">{v.answers.map((a, i) => <li key={i} className="rounded-2xl bg-white px-4 py-2"><span className="text-muted">{a.question}</span><br /><b>{a.answer}</b></li>)}</ul>
        </section>
      )}
    </div>
  )
}
