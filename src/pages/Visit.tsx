import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ShieldCheck, X } from 'lucide-react'
import { Badge, Eyebrow, Page, PillButton } from '../components/ui'
import { Dialpad } from '../components/Dialpad'
import { PatientSide, ShownOverlay } from '../components/hospital/PatientSide'
import { PresenceDot, SwitchModeButton } from '../components/hospital/PresenceDot'
import { AnswerPopup, SentencePopup } from '../components/hospital/SentencePopup'
import { PracticeTap, TeachClip } from '../components/hospital/Teach'
import { getVisit, lookupVisit, type VisitInfo } from '../lib/api'
import { realtimeConfigured } from '../lib/supabase'
import { UI } from '../data/assets'
import { useVisit } from '../visit/store'
import type { VisitEvent } from '../visit/events'

/** /v: type the 6-digit code. /v/:visitId?code=...: the patient's phone in a two-device visit. */
export default function Visit() {
  const { visitId } = useParams()
  const [sp] = useSearchParams()
  const location = useLocation()
  if (!visitId) return <CodeEntry />
  return <PatientVisit visitId={visitId} code={sp.get('code') ?? ''} preAllowed={!!(location.state as { allowed?: boolean } | null)?.allowed} />
}

function CodeEntry() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (value: string) => {
    setBusy(true)
    setError('')
    try {
      const info = await lookupVisit(value)
      nav(`/v/${info.id}?role=patient&code=${value}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find this code')
      setCode('')
    } finally { setBusy(false) }
  }

  return (
    <Page className="grid min-h-dvh place-items-center bg-ivory px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <Eyebrow>Join a visit</Eyebrow>
        <h1 className="h2 mt-4">Doctor&apos;s code</h1>
        <div className="my-6 flex justify-center gap-2.5" role="status" aria-label={`${code.length} of 6 digits entered`}>
          {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`grid h-14 w-11 place-items-center rounded-2xl border-2 text-2xl font-semibold ${code[i] ? 'border-ember bg-white' : 'border-line'}`}>{code[i] ?? ''}</span>)}
        </div>
        {error && <p role="alert" className="mb-3 font-semibold text-alert">{error}</p>}
        <Dialpad value={code} maxLength={6} noPlus hideDisplay onChange={(v) => { const d = v.replace(/\D/g, ''); setCode(d); setError(''); if (d.length === 6) void go(d) }} />
        {busy && <p className="mt-4 text-muted">Looking</p>}
        <Link to="/" className="mt-8 inline-block text-sm font-semibold text-muted underline-offset-4 hover:underline">Back to home</Link>
      </div>
    </Page>
  )
}

type Stage = 'loading' | 'error' | 'gate' | 'teach-clip' | 'teach-tap' | 'session'

const taughtKey = 'vc-taught'
const joinedKey = (id: string) => `vc-joined-${id}`
const read = (k: string, store: Storage) => { try { return store.getItem(k) } catch { return null } }
const write = (k: string, store: Storage) => { try { store.setItem(k, '1') } catch { /* ignore */ } }

function PatientVisit({ visitId, code, preAllowed }: { visitId: string; code: string; preAllowed: boolean }) {
  const nav = useNavigate()
  const [stage, setStage] = useState<Stage>(realtimeConfigured ? 'loading' : 'error')
  const [info, setInfo] = useState<VisitInfo | null>(null)
  const [error, setError] = useState(realtimeConfigured ? '' : 'This phone cannot join yet: the app is missing its connection settings.')

  const join = (i: VisitInfo) => {
    const store = useVisit.getState()
    store.begin({ visitId, code, role: 'patient', mode: i.mode, patient: { id: null, name: i.patient?.name ?? null, photo: i.patient?.photo_url ?? null }, events: (i.transcript ?? []) as VisitEvent[] })
    write(joinedKey(visitId), sessionStorage)
    if (!useVisit.getState().patientJoined) useVisit.getState().dispatch({ type: 'visit.patient_joined' })
    setStage(read(taughtKey, localStorage) || (i.transcript?.length ?? 0) > 0 ? 'session' : 'teach-clip')
  }

  useEffect(() => {
    if (!realtimeConfigured) return
    let alive = true
    getVisit(visitId, code)
      .then((i) => {
        if (!alive) return
        setInfo(i)
        if (i.status === 'ended') { setError('This visit has finished.'); setStage('error'); return }
        if (preAllowed || read(joinedKey(visitId), sessionStorage)) join(i)
        else setStage('gate')
      })
      .catch(() => { if (alive) { setError('This link is not valid, or the visit has finished.'); setStage('error') } })
    return () => { alive = false; useVisit.getState().reset() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId, code])

  if (stage === 'loading') return <div className="grid min-h-dvh place-items-center bg-ivory"><span className="glow block h-24 w-24" /></div>

  if (stage === 'error') {
    return (
      <main className="grid min-h-dvh place-items-center bg-ivory p-6 text-center">
        <div><h1 className="h3">{error}</h1><Link to="/v" className="mt-4 inline-block font-semibold text-ember underline underline-offset-4">Type a code instead</Link></div>
      </main>
    )
  }

  if (stage === 'gate' && info) {
    return (
      <Page className="grid min-h-dvh place-items-center bg-ivory p-5">
        <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
          <img src={UI.introDoctor} alt="A doctor wants to help you" width={720} height={720} className="w-full max-w-md rounded-[28px] object-cover shadow-soft" />
          <div>
            <p className="text-2xl font-semibold tracking-tight">{info.doctor?.name ?? 'A doctor'}</p>
            {info.doctor?.verified && <div className="mt-2"><Badge kind="verified"><ShieldCheck size={13} aria-hidden /> MDCN verified</Badge></div>}
          </div>
          <div className="flex items-start justify-center gap-10">
            <motion.button whileTap={{ scale: 0.93 }} aria-label="Allow" onClick={() => join(info)} className="flex flex-col items-center gap-2">
              <span className="grid h-36 w-36 place-items-center rounded-full bg-verified text-white shadow-lift"><Check size={72} strokeWidth={3.2} aria-hidden /></span>
              <span className="text-lg font-semibold text-verified">Allow</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} aria-label="No" onClick={() => nav('/')} className="flex flex-col items-center gap-2">
              <span className="grid h-36 w-36 place-items-center rounded-full bg-alert text-white shadow-lift"><X size={72} strokeWidth={3.2} aria-hidden /></span>
              <span className="text-lg font-semibold text-alert">No</span>
            </motion.button>
          </div>
        </div>
      </Page>
    )
  }

  if (stage === 'teach-clip') return <TeachClip onNext={() => setStage('teach-tap')} />
  if (stage === 'teach-tap') return <PracticeTap onDone={() => { write(taughtKey, localStorage); setStage('session') }} />

  return <PatientScreen />
}

function PatientScreen() {
  const { ended, mode, dispatch } = useVisit()

  if (ended) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ivory p-6 text-center">
        <div><span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-verified text-white"><Check size={48} strokeWidth={3} aria-hidden /></span><h1 className="h3 mt-5">Visit finished</h1><Link to="/" className="mt-4 inline-block font-semibold text-ember underline underline-offset-4">Home</Link></div>
      </main>
    )
  }

  // The doctor moved the visit to one shared device. This phone waits, and picks up again if it moves back.
  if (mode === 'one') {
    return (
      <main className="grid min-h-dvh place-items-center bg-ivory p-6 text-center">
        <div className="space-y-5">
          <img src={UI.hospitalTablet} alt="The visit continues on the doctor's device" width={360} height={360} className="mx-auto h-56 w-56 rounded-[28px] object-cover shadow-soft" />
          <h1 className="h3">The doctor&apos;s device has the visit</h1>
          <PillButton size="lg" onClick={() => dispatch({ type: 'visit.mode_changed', mode: 'two' })}>Use my phone again</PillButton>
        </div>
      </main>
    )
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-ivory">
      <div className="h-full overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <PresenceDot />
          <SwitchModeButton />
        </div>
        <PatientSide />
      </div>
      <AnimatePresence><ShownOverlay /></AnimatePresence>
      <AnimatePresence><SentencePopup /></AnimatePresence>
      <AnimatePresence><AnswerPopup /></AnimatePresence>
    </div>
  )
}
