import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check as CheckIcon, MessageCircle } from 'lucide-react'
import { SetupShell } from '../../components/SetupShell'
import { PillButton } from '../../components/ui'
import { normaliseNg } from '../../components/Dialpad'
import { UI } from '../../data/assets'
import { useDevice } from '../../store/device'
import { getHelpStatus, renewJoinLink } from '../../lib/api'
import { whatsappLink } from '../../lib/whatsapp'

export default function Check() {
  const nav = useNavigate()
  const { helpPhone, helpJoinToken, patientId, token, helpConfirmed, setHelpConfirmed, setJoin } = useDevice()
  const [opened, setOpened] = useState(false)
  const number = normaliseNg(helpPhone) ?? ''

  // Ask every 3 seconds whether the help person has joined. An expired link is replaced quietly,
  // so the WhatsApp button always sends one that works.
  useEffect(() => {
    if (helpConfirmed || !patientId || !token) return
    let renewing = false
    const poll = async () => {
      try {
        const s = await getHelpStatus(patientId, token)
        if (s.confirmed) setHelpConfirmed(true)
        else if (s.linkExpired && !renewing) {
          renewing = true
          try { setJoin(await renewJoinLink(patientId, token)) } finally { renewing = false }
        }
      } catch { /* keep waiting */ }
    }
    void poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [helpConfirmed, patientId, token, setHelpConfirmed, setJoin])

  const open = () => {
    const link = `${window.location.origin}/join/${helpJoinToken}`
    const text = `Hi, I added you as my VoxCare help person. If I'm ever in an emergency, you'll get an email. Tap to join: ${link}`
    window.open(whatsappLink(number, text), '_blank', 'noopener')
    setOpened(true)
  }

  return (
    <SetupShell step={4} back="/setup/help" title={helpConfirmed ? 'They joined' : 'Check'}
      footer={helpConfirmed
        ? <PillButton size="lg" onClick={() => nav('/card')}>Next</PillButton>
        : <PillButton size="lg" variant="dark" noIcon onClick={() => nav('/card')}>Skip for now</PillButton>}>
      {helpConfirmed ? (
        <>
          <img src={UI.helpFamily} alt="Your help person joined" width={360} height={360} className="h-56 w-56 rounded-[28px] object-cover shadow-soft sm:h-72 sm:w-72" />
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} className="grid h-32 w-32 place-items-center rounded-full bg-verified text-white shadow-lift" role="img" aria-label="They joined">
            <CheckIcon size={64} strokeWidth={3.2} aria-hidden />
          </motion.span>
        </>
      ) : (
        <>
          <img src={UI.setupDial} alt="A phone sending a message" width={360} height={360} className="h-56 w-56 rounded-[28px] object-cover shadow-soft sm:h-72 sm:w-72" />
          <button onClick={open} className="flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-full bg-verified px-8 text-2xl font-semibold text-white shadow-lift active:scale-[0.98]">
            <MessageCircle size={32} aria-hidden /> WhatsApp
          </button>
          {opened && <p role="status" className="flex items-center gap-3 text-lg font-semibold text-muted"><span className="glow inline-block h-6 w-6" aria-hidden /> Waiting for your help person</p>}
        </>
      )}
    </SetupShell>
  )
}
