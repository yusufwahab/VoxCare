import { ArrowLeftRight } from 'lucide-react'
import { realtimeConfigured } from '../../lib/supabase'
import { useVisit } from '../../visit/store'
import { cx } from '../ui'

/** Connection state in two-device mode. Renders nothing when both people share one device. */
export function PresenceDot() {
  const { mode, connection, peerPresent, role } = useVisit()
  if (mode === 'one' && role === 'doctor') return null
  const other = role === 'doctor' ? 'patient' : 'doctor'

  let text: string
  let tone: 'ok' | 'wait' | 'warn'
  if (connection === 'reconnecting') { text = 'Reconnecting…'; tone = 'warn' }
  else if (connection === 'connecting' || connection === 'local') { text = 'Connecting…'; tone = 'wait' }
  else if (!peerPresent) { text = `Waiting for ${other}…`; tone = 'wait' }
  else { text = 'Connected'; tone = 'ok' }

  return (
    <span role="status" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold">
      <span className={cx('h-2.5 w-2.5 rounded-full', tone === 'ok' && 'bg-verified', tone === 'wait' && 'animate-pulse bg-amber', tone === 'warn' && 'animate-pulse bg-alert')} aria-hidden />
      {text}
    </span>
  )
}

/** Move the same visit between one device and two. Nothing is lost: the other side replays the transcript. */
export function SwitchModeButton() {
  const { mode, role, dispatch } = useVisit()
  const next = mode === 'one' ? 'two' : 'one'
  // A patient on a single shared device has no one to switch with
  if (role === 'patient' && mode === 'one') return null
  if (next === 'two' && !realtimeConfigured) return null
  return (
    <button onClick={() => dispatch({ type: 'visit.mode_changed', mode: next })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:bg-sand">
      <ArrowLeftRight size={16} aria-hidden /> {role === 'doctor' ? (next === 'two' ? 'Use two devices' : 'Use one device') : 'Switch mode'}
    </button>
  )
}
