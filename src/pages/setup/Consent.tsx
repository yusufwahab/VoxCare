import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { SetupShell } from '../../components/SetupShell'
import { PictureCard, PillButton, cx } from '../../components/ui'
import { UI } from '../../data/assets'
import { useDevice } from '../../store/device'

export default function Consent() {
  const nav = useNavigate()
  const { consented, setConsent } = useDevice()
  return (
    <SetupShell step={1} back="/" title="Your choice"
      footer={<PillButton size="lg" disabled={!consented} onClick={() => nav('/setup/me')}>Next</PillButton>}>
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-3">
        <PictureCard src={UI.consentPrivate} label="Private" size="lg" />
        <PictureCard src={UI.consentAllow} label="You allow" size="lg" />
        <PictureCard src={UI.consentDelete} label="Delete anytime" size="lg" />
      </div>
      <motion.button
        whileTap={{ scale: 0.98 }} onClick={() => setConsent(!consented)} role="checkbox" aria-checked={consented}
        className={cx('flex w-full max-w-md items-center gap-5 rounded-[24px] border-2 p-5 text-left transition-colors', consented ? 'border-verified bg-verified-bg' : 'border-line bg-white')}
      >
        <span className={cx('grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 transition-colors', consented ? 'border-verified bg-verified text-white' : 'border-line bg-ivory')}>
          {consented && <Check size={40} strokeWidth={3.5} aria-hidden />}
        </span>
        <span className="text-2xl font-semibold tracking-tight">I agree</span>
      </motion.button>
    </SetupShell>
  )
}
