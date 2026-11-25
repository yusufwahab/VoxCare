import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Check, Volume2, X } from 'lucide-react'
import { MiniBody } from '../BodyMap'
import { PillButton } from '../ui'
import { byId } from '../../data/assets'
import { useVisit } from '../../store/visit'
import { speak } from '../../lib/speech'

/** Writes the patient's sentence out as large text, so it is read as well as heard. */
export function SentencePopup() {
  const { sentenceOpen, submitted, submittedPins, feel, events, feelings, set } = useVisit()
  const close = () => set({ sentenceOpen: false })

  useEffect(() => {
    if (!sentenceOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!sentenceOpen || !submitted) return null
  const picked = [...feel, ...events, ...feelings].map(byId).filter((a) => !!a)
  const backPins = submittedPins.some((p) => p.view === 'back')
  const frontPins = submittedPins.some((p) => p.view === 'front')

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] grid place-items-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="What the patient says" onClick={close}
    >
      <motion.div
        initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-[28px] bg-ivory p-6 shadow-soft sm:p-10"
      >
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">The patient says</p>
        <p className="mt-3 text-[clamp(1.75rem,4.2vw,3rem)] font-semibold leading-snug tracking-tight" aria-live="polite">{submitted}</p>

        {(picked.length > 0 || submittedPins.length > 0) && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {frontPins && <MiniBody pins={submittedPins} view="front" height="150px" />}
            {backPins && <MiniBody pins={submittedPins} view="back" height="150px" />}
            {picked.map((a) => a && (
              <span key={a.id} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-4 font-semibold">
                <img src={a.poster ?? a.src} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
                {a.doctorText}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => speak(submitted)} className="inline-flex min-h-14 items-center gap-2 rounded-full border border-line bg-white px-6 font-semibold">
            <Volume2 size={20} aria-hidden /> Speak again
          </button>
          <PillButton size="lg" onClick={close} icon={<Check size={22} />}>OK</PillButton>
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Writes the patient's answer (tick, cross, "I understand") out as large text. */
export function AnswerPopup() {
  const answerOpen = useVisit((s) => s.answerOpen)
  const set = useVisit((s) => s.set)
  const close = () => set({ answerOpen: null })

  useEffect(() => {
    if (!answerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!answerOpen) return null
  const understood = answerOpen.answer === 'Understood'
  const yes = /^yes/i.test(answerOpen.answer) || understood
  const no = /^no\b/i.test(answerOpen.answer)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[56] grid place-items-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="The patient answers" onClick={close}
    >
      <motion.div
        initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-[28px] bg-ivory p-6 shadow-soft sm:p-10"
      >
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">The patient answers</p>
        <p className="mt-3 text-lg text-muted">{answerOpen.question}</p>
        <div className="mt-3 flex items-start gap-4">
          {(yes || no) && (
            <span className={`mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-full text-white ${no ? 'bg-alert' : 'bg-verified'}`} aria-hidden>
              {no ? <X size={30} strokeWidth={3.2} /> : <Check size={30} strokeWidth={3.2} />}
            </span>
          )}
          <p className="text-[clamp(1.75rem,4.2vw,2.75rem)] font-semibold leading-snug tracking-tight" aria-live="polite">
            {understood ? 'I understand.' : answerOpen.answer}
          </p>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => speak(understood ? 'I understand.' : answerOpen.answer)} className="inline-flex min-h-14 items-center gap-2 rounded-full border border-line bg-white px-6 font-semibold">
            <Volume2 size={20} aria-hidden /> Speak again
          </button>
          <PillButton size="lg" onClick={close} icon={<Check size={22} />}>OK</PillButton>
        </div>
      </motion.div>
    </motion.div>
  )
}
