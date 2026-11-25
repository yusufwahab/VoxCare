import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Check, Nfc, QrCode, UserPlus, X, Stethoscope, ShieldCheck } from 'lucide-react'
import { Badge, Eyebrow, Page, cx } from '../components/ui'
import { Dialpad } from '../components/Dialpad'
import { Scanner, nfcSupported, readNfc } from '../components/Scanner'
import { DoctorSession } from '../components/hospital/DoctorSession'
import { ModeChoice } from '../components/hospital/ModeChoice'
import { PracticeTap, TeachClip } from '../components/hospital/Teach'
import { createVisit, doctorLogin, getPatientPublic, DEMO_ID, isMockBackend } from '../lib/api'
import { warmVoices } from '../lib/speech'
import { UI } from '../data/assets'
import { useStaff } from '../store/device'
import { useVisit } from '../visit/store'
import { sendJoinPrompt } from '../visit/transport'
import type { VisitMode } from '../visit/events'
import type { PatientPublic } from '../lib/types'

type Stage = 'login' | 'start' | 'mode' | 'allow' | 'teach-clip' | 'teach-tap' | 'session'

export default function Hospital() {
  const doctor = useStaff((s) => s.doctor)
  const setDoctor = useStaff((s) => s.setDoctor)
  const [stage, setStage] = useState<Stage>(doctor ? 'start' : 'login')
  /** The patient picked at the start. null means a walk-in. */
  const [candidate, setCandidate] = useState<PatientPublic | null>(null)
  const [scanning, setScanning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { warmVoices() }, [])

  const reset = () => { useVisit.getState().reset(); setCandidate(null); setError(''); setStage('start') }

  const loadPatient = useCallback(async (id: string) => {
    setScanning(false)
    const p = await getPatientPublic(id)
    if (!p) { alert('This card was not found.'); return }
    setCandidate(p)
    setStage('mode')
  }, [])

  const nfc = async () => {
    try { const id = await readNfc(); if (id) loadPatient(id) } catch { alert('NFC is not available or was not allowed.') }
  }

  /** Make the visit, then go to the right place for the chosen mode */
  const startVisit = async (mode: VisitMode) => {
    setStarting(true)
    setError('')
    try {
      const { id, code } = await createVisit(candidate?.id ?? null, mode)
      useVisit.getState().begin({ visitId: id, code, role: 'doctor', mode, patient: { id: candidate?.id ?? null, name: candidate?.name ?? null, photo: candidate?.photo_url ?? null } })
      if (mode === 'one') setStage(candidate ? 'allow' : 'teach-clip')
      else {
        // Card scanned: knock on the patient's phone, if VoxCare is open there
        if (candidate) void sendJoinPrompt(candidate.id, id, code).catch(() => {})
        setStage('session')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the visit.')
    } finally {
      setStarting(false)
    }
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
            <button onClick={() => { setCandidate(null); setStage('mode') }} className="rounded-[28px] border border-line bg-white p-7 text-left shadow-soft transition-transform hover:-translate-y-0.5">
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

  if (stage === 'mode') {
    return (
      <>
        <ModeChoice who={candidate ? (candidate.name ?? 'Patient card') : 'Walk-in visit'} busy={starting} onBack={() => { setCandidate(null); setStage('start') }} onChoose={startVisit} />
        {error && <p role="alert" className="fixed inset-x-0 bottom-6 text-center font-semibold text-alert">{error}</p>}
      </>
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
            <motion.button whileTap={{ scale: 0.93 }} aria-label="Allow" onClick={() => setStage('teach-clip')} className="flex flex-col items-center gap-2">
              <span className="grid h-36 w-36 place-items-center rounded-full bg-verified text-white shadow-lift"><Check size={72} strokeWidth={3.2} aria-hidden /></span>
              <span className="text-lg font-semibold text-verified">Allow</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} aria-label="No" onClick={() => { void useVisit.getState().end(); reset() }} className="flex flex-col items-center gap-2">
              <span className="grid h-36 w-36 place-items-center rounded-full bg-alert text-white shadow-lift"><X size={72} strokeWidth={3.2} aria-hidden /></span>
              <span className="text-lg font-semibold text-alert">No</span>
            </motion.button>
          </div>
        </div>
      </Page>
    )
  }

  if (stage === 'teach-clip') return <TeachClip onNext={() => setStage('teach-tap')} />
  if (stage === 'teach-tap') return <PracticeTap onDone={() => setStage('session')} />

  return <DoctorSession onFinished={reset} />
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
