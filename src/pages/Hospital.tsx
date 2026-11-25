import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Nfc, QrCode, UserPlus, X, Stethoscope, ShieldCheck } from 'lucide-react'
import { Badge, ClipCard, Eyebrow, FullScreen, Page, PillButton, cx } from '../components/ui'
import { Dialpad } from '../components/Dialpad'
import { BodyMap } from '../components/BodyMap'
import { Scanner, nfcSupported, readNfc } from '../components/Scanner'
import { PatientSide, ShownOverlay } from '../components/hospital/PatientSide'
import { DoctorPanel } from '../components/hospital/DoctorPanel'
import { EndVisit } from '../components/hospital/EndVisit'
import { doctorLogin, getPatientPublic, DEMO_ID, isMockBackend } from '../lib/api'
import { warmVoices } from '../lib/speech'
import { UI } from '../data/assets'
import { useStaff } from '../store/device'
import { useVisit } from '../store/visit'
import type { PatientPublic } from '../lib/types'
import { detectRegion } from '../lib/regions'

type Stage = 'login' | 'start' | 'allow' | 'teach-clip' | 'teach-tap' | 'session'

export default function Hospital() {
  const doctor = useStaff((s) => s.doctor)
  const setDoctor = useStaff((s) => s.setDoctor)
  const visit = useVisit()
  const [stage, setStage] = useState<Stage>(doctor ? 'start' : 'login')
  const [candidate, setCandidate] = useState<PatientPublic | null>(null)
  const [scanning, setScanning] = useState(false)
  const [ending, setEnding] = useState(false)
  const [tab, setTab] = useState<'patient' | 'doctor'>('patient')

  useEffect(() => { warmVoices() }, [])

  const reset = () => { visit.reset(); setCandidate(null); setEnding(false); setStage('start') }

  const loadPatient = useCallback(async (id: string) => {
    setScanning(false)
    const p = await getPatientPublic(id)
    if (!p) { alert('This card was not found.'); return }
    setCandidate(p)
    setStage('allow')
  }, [])

  const nfc = async () => {
    try { const id = await readNfc(); if (id) loadPatient(id) } catch { alert('NFC is not available or was not allowed.') }
  }

  if (stage === 'login' || !doctor) {
    return <PinLogin onDone={(d) => { setDoctor(d); setStage('start') }} />
  }

  if (stage === 'start') {
    return (
      <Page className="grid min-h-dvh place-items-center bg-ivory px-5 py-10">
        <div className="w-full max-w-3xl">
          <div className="mb-8 flex items-center justify-between">
            <Eyebrow>Hospital mode</Eyebrow>
            <Link to="/" className="text-sm font-semibold text-muted underline-offset-4 hover:underline">Home</Link>
          </div>
          <h1 className="h2 mb-2">Start a visit</h1>
          <p className="mb-8 flex items-center gap-2 text-muted"><Stethoscope size={18} aria-hidden /> {doctor.name}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <button onClick={() => setScanning(true)} className="group rounded-[28px] bg-cocoa p-7 text-left text-ivory shadow-soft transition-transform hover:-translate-y-0.5">
              <QrCode size={34} aria-hidden className="text-amber" />
              <span className="mt-10 block text-2xl font-semibold tracking-tight">Scan patient card</span>
              <span className="mt-1 block text-ivory/70">Use the camera on the QR code</span>
            </button>
            <button onClick={() => { visit.start({ id: null, name: null, photo: null }); setStage('teach-clip') }} className="rounded-[28px] border border-line bg-white p-7 text-left shadow-soft transition-transform hover:-translate-y-0.5">
              <UserPlus size={34} aria-hidden className="text-ember" />
              <span className="mt-10 block text-2xl font-semibold tracking-tight">New walk-in visit</span>
              <span className="mt-1 block text-muted">No card. Nothing is saved to a profile.</span>
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {nfcSupported() && <button onClick={nfc} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-5 font-semibold"><Nfc size={18} aria-hidden /> Tap NFC sticker</button>}
            <button onClick={() => loadPatient(DEMO_ID)} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-5 font-semibold">Use demo patient <ArrowRight size={16} aria-hidden /></button>
          </div>
          {isMockBackend() && <p className="mt-6 text-sm text-muted">Demo data mode: the server is not connected yet.</p>}
        </div>
        {scanning && <Scanner onResult={loadPatient} onClose={() => setScanning(false)} />}
      </Page>
    )
  }

  if (stage === 'allow' && candidate) {
    return (
      <Page className="grid min-h-dvh place-items-center bg-ivory p-5">
        <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
          <img src={UI.introDoctor} alt="A doctor wants to help you" width={720} height={720} className="w-full max-w-md rounded-[28px] object-cover shadow-soft" />
          <div>
            <p className="text-2xl font-semibold tracking-tight">{doctor.name}</p>
            <div className="mt-2"><Badge kind="verified"><ShieldCheck size={13} aria-hidden /> MDCN verified</Badge></div>
          </div>
          <div className="flex items-start justify-center gap-10">
            <motion.button whileTap={{ scale: 0.93 }} aria-label="Allow" onClick={() => { visit.start({ id: candidate.id, name: candidate.name, photo: candidate.photo_url }); setStage('teach-clip') }} className="flex flex-col items-center gap-2">
              <span className="grid h-36 w-36 place-items-center rounded-full bg-verified text-white shadow-lift"><Check size={72} strokeWidth={3.2} aria-hidden /></span>
              <span className="text-lg font-semibold text-verified">Allow</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} aria-label="No" onClick={reset} className="flex flex-col items-center gap-2">
              <span className="grid h-36 w-36 place-items-center rounded-full bg-alert text-white shadow-lift"><X size={72} strokeWidth={3.2} aria-hidden /></span>
              <span className="text-lg font-semibold text-alert">No</span>
            </motion.button>
          </div>
        </div>
      </Page>
    )
  }

  if (stage === 'teach-clip') {
    return (
      <Page className="grid min-h-dvh place-items-center bg-ivory p-5">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8">
          <div className="aspect-video w-full overflow-hidden rounded-[28px] bg-sand shadow-soft">
            <ClipCard src={UI.demoTap} poster={UI.demoTapPoster} alt="A hand taps the body on the screen" />
          </div>
          <PillButton size="lg" ariaLabel="Next" onClick={() => setStage('teach-tap')} noIcon={false}>Next</PillButton>
        </div>
      </Page>
    )
  }

  if (stage === 'teach-tap') return <PracticeTap onDone={() => setStage('session')} />

  // ---- Session ----
  return (
    <div className="flex h-dvh flex-col bg-ivory">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2 lg:hidden">
        <div className="inline-flex rounded-full bg-sand p-1" role="tablist">
          {(['patient', 'doctor'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('min-h-11 rounded-full px-6 font-semibold capitalize', tab === t ? 'bg-ink text-ivory' : 'text-muted')}>{t}</button>
          ))}
        </div>
        <button onClick={() => setEnding(true)} className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold">End visit</button>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[3fr_2fr]">
        <section className={cx('relative min-h-0 overflow-y-auto', tab === 'doctor' && 'hidden lg:block')} aria-label="Patient">
          <PatientSide />
          <AnimatePresence><ShownOverlay /></AnimatePresence>
        </section>
        <section className={cx('min-h-0 overflow-y-auto border-line bg-sand/50 lg:border-l', tab === 'patient' && 'hidden lg:block')} aria-label="Doctor">
          <DoctorPanel onEnd={() => setEnding(true)} />
        </section>
      </div>
      {ending && <EndVisit onClose={() => setEnding(false)} onFinished={reset} />}
    </div>
  )
}

function PinLogin({ onDone }: { onDone: (d: NonNullable<ReturnType<typeof useStaff.getState>['doctor']>) => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    setBusy(true)
    const d = await doctorLogin(value)
    setBusy(false)
    if (d) onDone(d)
    else { setErr(true); setPin('') }
  }

  return (
    <Page className="grid min-h-dvh place-items-center bg-ivory px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <Eyebrow>Hospital mode</Eyebrow>
        <h1 className="h2 mt-4">Doctor PIN</h1>
        <div className="my-6 flex justify-center gap-4" aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-5 w-5 rounded-full border-2 transition-colors', i < pin.length ? 'border-ember bg-ember' : 'border-line bg-transparent', err && 'border-alert')} />)}
        </div>
        {err && <p role="alert" className="mb-3 font-semibold text-alert">That PIN is not right. Try again.</p>}
        <Dialpad value={pin} maxLength={4} onChange={(v) => { setErr(false); setPin(v.replace(/\D/g, '')); if (v.replace(/\D/g, '').length === 4) submit(v.replace(/\D/g, '')) }} hideDisplay />
        {busy && <p className="mt-4 text-muted">Checking</p>}
        <Link to="/" className="mt-8 inline-block text-sm font-semibold text-muted underline-offset-4 hover:underline">Back to home</Link>
      </div>
    </Page>
  )
}

/** Teach: practice tap on the head with an animated hand */
function PracticeTap({ onDone }: { onDone: () => void }) {
  const [glow, setGlow] = useState<{ x: number; y: number } | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(onDone, 1000)
    return () => clearTimeout(t)
  }, [done, onDone])

  return (
    <Page className="grid min-h-dvh place-items-center bg-ivory p-4">
      <div className="flex flex-col items-center gap-5">
        <BodyMap view="front" pins={[]} readOnly={false} showFlip={false} height="min(74vh, 780px)"
          onTap={(x, y) => {
            if (done) return true
            const r = detectRegion('front', x, y)
            if (!r || !/^(head|face|jaw)-/.test(r.id)) return true
            setGlow({ x, y })
            setTimeout(() => setDone(true), 450)
            return true
          }}
          overlay={
            <>
              {/* head highlight */}
              <span className="pointer-events-none absolute left-[50.5%] top-[14.5%] block h-[17%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber/70" style={{ boxShadow: '0 0 40px 6px rgba(232,131,58,.45)' }} />
              <span className="pulse-ring pointer-events-none absolute left-[50.5%] top-[15%] block h-[20%] w-[32%] -translate-x-1/2 -translate-y-1/2" />
              {!glow && (
                <span className="pointer-events-none absolute left-[50.5%] top-[15%]" style={{ animation: 'tap-hand 2.4s ease-in-out infinite' }} aria-hidden>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FBF6EE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.6))' }}>
                    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-3a1.5 1.5 0 0 1 3 0v6.5A6.5 6.5 0 0 1 11.5 20h-1A6.5 6.5 0 0 1 6 18l-2.6-4.3a1.5 1.5 0 0 1 2.4-1.7L9 14" fill="rgba(251,246,238,.15)" />
                  </svg>
                </span>
              )}
              {glow && <span className="glow pointer-events-none absolute block h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${glow.x}%`, top: `${glow.y}%` }} />}
            </>
          }
        />
        <p className="h3 text-center">Tap the head</p>
      </div>
      <AnimatePresence>
        {done && (
          <FullScreen>
            <img src={UI.practiceDone} alt="Well done" width={900} height={900} className="max-h-[80vh] w-auto rounded-[28px] object-contain shadow-soft" />
          </FullScreen>
        )}
      </AnimatePresence>
    </Page>
  )
}

