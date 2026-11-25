import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Settings } from 'lucide-react'
import { Page, PictureCard, PillButton } from '../components/ui'
import { VoxCard } from '../components/VoxCard'
import { FACTS, UI } from '../data/assets'
import { useDevice } from '../store/device'
import { addSelfFacts } from '../lib/api'

export default function Home() {
  const { patientId, token, name, photo } = useDevice()
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  if (!patientId) return <Navigate to="/start" replace />

  const save = async () => {
    const facts = FACTS.filter((f) => picked.includes(f.id)).map((f) => ({ type: 'body_fact' as const, value: f.doctorText }))
    if (token && facts.length) await addSelfFacts(patientId, token, facts)
    setSaved(true)
    setAdding(false)
    setPicked([])
  }

  return (
    <Page className="min-h-dvh bg-ivory">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 pt-5">
        {adding ? <button onClick={() => setAdding(false)} aria-label="Back" className="grid h-12 w-12 place-items-center rounded-full bg-sand"><ArrowLeft aria-hidden /></button> : <span className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted">VoxCare</span>}
        <Link to="/hospital" aria-label="Staff mode" className="grid h-12 w-12 place-items-center rounded-full bg-sand"><Settings size={20} aria-hidden /></Link>
      </header>

      {!adding ? (
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-5 pb-16 pt-6">
          <div className="grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
            <Link to="/hospital" className="group block">
              <motion.span whileTap={{ scale: 0.97 }} className="block overflow-hidden rounded-[28px] bg-sand shadow-soft">
                <img src={UI.talkDoctor} alt="Talk to a doctor" width={640} height={640} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </motion.span>
              <span className="mt-3 block text-center text-2xl font-semibold tracking-tight">Talk to a doctor</span>
            </Link>
            <Link to="/card" className="group flex flex-col items-center">
              <motion.span whileTap={{ scale: 0.97 }} className="grid aspect-square w-full place-items-center rounded-[28px] bg-sand p-4 shadow-soft">
                <VoxCard patientId={patientId} name={name} photo={photo} mini />
              </motion.span>
              <span className="mt-3 block text-center text-2xl font-semibold tracking-tight">My card</span>
            </Link>
          </div>
          <button onClick={() => setAdding(true)} className="min-h-12 text-base font-semibold text-muted underline underline-offset-4">Add more about me</button>
          {saved && <p role="status" className="font-semibold text-verified">Saved to your card.</p>}
        </div>
      ) : (
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-5 pb-16 pt-4">
          <h1 className="h2 text-center">About me</h1>
          <div className="grid w-full grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {FACTS.map((f) => (
              <PictureCard key={f.id} size="lg" src={f.src} label={f.label} selected={picked.includes(f.id)} onClick={() => setPicked((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))} />
            ))}
          </div>
          <PillButton size="lg" disabled={picked.length === 0} onClick={save}>Save</PillButton>
        </div>
      )}
    </Page>
  )
}
