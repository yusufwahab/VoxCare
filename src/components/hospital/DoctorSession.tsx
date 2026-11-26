import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, HandHelping, QrCode, Volume2 } from 'lucide-react'
import { PatientSide, ShownOverlay } from './PatientSide'
import { DoctorPanel } from './DoctorPanel'
import { EndVisit } from './EndVisit'
import { InvitePanel } from './InvitePanel'
import { PresenceDot, SwitchModeButton } from './PresenceDot'
import { AnswerPopup, SentencePopup } from './SentencePopup'
import { PillButton } from '../ui'
import { useMediaQuery, WIDE_LANDSCAPE } from '../../hooks/useMediaQuery'
import { useVisit } from '../../visit/store'
import { speak } from '../../lib/speech'

/**
 * The doctor device during a visit.
 *  - one device, wide landscape: split view (patient left, doctor right)
 *  - one device, phone or portrait: full-screen hand-over between doctor and patient
 *  - two devices: doctor controls only (the patient is on their own phone)
 */
export function DoctorSession({ onFinished }: { onFinished: () => void }) {
  const mode = useVisit((s) => s.mode)
  const wide = useMediaQuery(WIDE_LANDSCAPE)
  const [ending, setEnding] = useState(false)

  return (
    <div className="h-dvh overflow-hidden bg-ivory">
      {mode === 'two' ? <TwoDevices onEnd={() => setEnding(true)} /> : wide ? <SplitView onEnd={() => setEnding(true)} /> : <HandOver onEnd={() => setEnding(true)} />}
      <AnimatePresence><SentencePopup /></AnimatePresence>
      <AnimatePresence><AnswerPopup /></AnimatePresence>
      {ending && <EndVisit onClose={() => setEnding(false)} onFinished={onFinished} />}
    </div>
  )
}

/** Existing single-device tablet layout */
function SplitView({ onEnd }: { onEnd: () => void }) {
  return (
    <div className="grid h-full grid-cols-[3fr_2fr]">
      <section className="relative min-h-0 overflow-y-auto" aria-label="Patient">
        <PatientSide />
        <AnimatePresence><ShownOverlay /></AnimatePresence>
      </section>
      <section className="min-h-0 overflow-y-auto border-l border-line bg-sand/50" aria-label="Doctor">
        <DoctorPanel onEnd={onEnd} toolbar={<SwitchModeButton />} />
      </section>
    </div>
  )
}

/** One phone or portrait tablet: a big button hands the device across, with a slide */
function HandOver({ onEnd }: { onEnd: () => void }) {
  const [handed, setHanded] = useState(false)

  // The device changes hands by itself, so nobody has to keep tapping the button:
  // to the patient when the doctor sends something, back to the doctor when the patient has finished.
  useEffect(() => {
    return useVisit.subscribe((s, prev) => {
      if (!prev.shown && s.shown) setHanded(true)
      if ((prev.sentenceOpen && !s.sentenceOpen) || (prev.answerOpen && !s.answerOpen)) setHanded(false)
      if (!prev.pictureRequested && s.pictureRequested) setHanded(false)
    })
  }, [])

  return (
    <div className="relative h-full overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        {handed ? (
          <motion.section key="patient" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.28 }} className="absolute inset-0 overflow-y-auto bg-ivory" aria-label="Patient">
            {/* A slim bar above the page, so it never covers the title */}
            <div className="sticky top-0 z-30 flex items-center border-b border-line bg-ivory/95 px-2 py-1 backdrop-blur">
              <button onClick={() => setHanded(false)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-sand">
                <ArrowLeft size={16} aria-hidden /> Back to doctor
              </button>
            </div>
            <div className="relative min-h-[calc(100%-3rem)]">
              <PatientSide />
              <AnimatePresence><ShownOverlay /></AnimatePresence>
            </div>
          </motion.section>
        ) : (
          <motion.section key="doctor" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.28 }} className="absolute inset-0 overflow-y-auto bg-sand/50" aria-label="Doctor">
            <DoctorPanel onEnd={onEnd} layout="tabs" toolbar={<SwitchModeButton />} />
            <div className="safe-b sticky bottom-0 bg-gradient-to-t from-sand via-sand/90 to-transparent px-5 pt-6">
              <div className="mx-auto flex max-w-md justify-center">
                <PillButton size="lg" variant="dark" className="w-full" icon={<HandHelping size={22} />} onClick={() => setHanded(true)}>Hand to patient</PillButton>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Two devices: the doctor only needs controls, plus how the patient joins and whether they are here */
function TwoDevices({ onEnd }: { onEnd: () => void }) {
  const { peerPresent, voiceReady, setVoiceReady } = useVisit()
  const [inviteOpen, setInviteOpen] = useState(true)
  const showInvite = inviteOpen && !peerPresent

  return (
    <div className="h-full overflow-y-auto bg-sand/50">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-5 sm:px-7">
          <PresenceDot />
          <SwitchModeButton />
          {peerPresent && <span className="sr-only">Patient connected</span>}
          {!peerPresent && !showInvite && (
            <button onClick={() => setInviteOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold"><QrCode size={16} aria-hidden /> Invite</button>
          )}
        </div>

        {!voiceReady && (
          <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-self-bg p-4 sm:mx-7">
            <p className="min-w-0 flex-1 text-sm font-semibold">Tap once so this phone can speak the patient&apos;s words aloud.</p>
            <button onClick={() => { speak('Voice is on.'); setVoiceReady() }} className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-ember px-4 font-semibold text-ink">
              <Volume2 size={18} aria-hidden /> Enable voice
            </button>
          </div>
        )}

        {showInvite && <div className="mx-5 mt-4 sm:mx-7"><InvitePanel /></div>}
        <DoctorPanel onEnd={onEnd} layout="tabs" />
      </div>
    </div>
  )
}
