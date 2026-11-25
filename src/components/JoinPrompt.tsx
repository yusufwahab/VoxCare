import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, ShieldCheck, X } from 'lucide-react'
import { Badge, FullScreen } from './ui'
import { getVisit } from '../lib/api'
import { getSupabase, realtimeConfigured } from '../lib/supabase'
import { UI } from '../data/assets'
import { useDevice } from '../store/device'

interface Request { visitId: string; code: string; doctor: { name: string; verified: boolean } | null }

/**
 * Shown on a patient's phone while VoxCare is open, when a doctor scans their card and starts a two-device visit.
 * The doctor's details are fetched from the server, never taken from the message itself.
 */
export function JoinPrompt() {
  const patientId = useDevice((s) => s.patientId)
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [req, setReq] = useState<Request | null>(null)

  useEffect(() => {
    if (!patientId || !realtimeConfigured) return
    const sb = getSupabase()
    const channel = sb.channel(`patient:${patientId}`)
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        const { visitId, code } = (payload ?? {}) as { visitId?: unknown; code?: unknown }
        if (typeof visitId !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) return
        try {
          const info = await getVisit(visitId, code)
          if (info.status === 'ended') return
          setReq({ visitId, code, doctor: info.doctor })
        } catch { /* not a real visit */ }
      })
      .subscribe()
    return () => { void sb.removeChannel(channel) }
  }, [patientId])

  // Staff devices and the visit itself do not need the prompt
  if (!req || pathname.startsWith('/hospital') || pathname.startsWith('/v')) return null

  return (
    <FullScreen>
      <img src={UI.introDoctor} alt="A doctor wants to help you" width={720} height={720} className="w-full max-w-sm rounded-[28px] object-cover shadow-soft" />
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight">{req.doctor?.name ?? 'A doctor'}</p>
        {req.doctor?.verified && <div className="mt-2"><Badge kind="verified"><ShieldCheck size={13} aria-hidden /> MDCN verified</Badge></div>}
      </div>
      <div className="flex items-start justify-center gap-10">
        <motion.button whileTap={{ scale: 0.93 }} aria-label="Allow" onClick={() => { const r = req; setReq(null); nav(`/v/${r.visitId}?role=patient&code=${r.code}`, { state: { allowed: true } }) }} className="flex flex-col items-center gap-2">
          <span className="grid h-32 w-32 place-items-center rounded-full bg-verified text-white shadow-lift"><Check size={64} strokeWidth={3.2} aria-hidden /></span>
          <span className="text-lg font-semibold text-verified">Allow</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.93 }} aria-label="No" onClick={() => setReq(null)} className="flex flex-col items-center gap-2">
          <span className="grid h-32 w-32 place-items-center rounded-full bg-alert text-white shadow-lift"><X size={64} strokeWidth={3.2} aria-hidden /></span>
          <span className="text-lg font-semibold text-alert">No</span>
        </motion.button>
      </div>
    </FullScreen>
  )
}
