import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Contact } from 'lucide-react'
import { SetupShell } from '../../components/SetupShell'
import { PillButton } from '../../components/ui'
import { Dialpad, normaliseNg } from '../../components/Dialpad'
import { UI } from '../../data/assets'
import { useDevice } from '../../store/device'
import { createPatient, requestBriefing } from '../../lib/api'

interface ContactsApi { select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> }

export default function Help() {
  const nav = useNavigate()
  const d = useDevice()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const contacts = (navigator as unknown as { contacts?: ContactsApi }).contacts
  const canPick = !!contacts && 'ContactsManager' in window

  const normalised = normaliseNg(d.helpPhone)

  const pick = async () => {
    try {
      const [c] = await contacts!.select(['name', 'tel'], { multiple: false })
      if (c?.tel?.[0]) d.setHelp({ helpPhone: c.tel[0].replace(/[\s()-]/g, ''), helpName: c.name?.[0] ?? d.helpName })
    } catch { /* cancelled */ }
  }

  const next = async () => {
    if (!normalised) return setError('Check the number. It should be 11 digits, like 08012345678.')
    setBusy(true)
    try {
      const { id, token, join_token } = await createPatient({ name: d.name || null, photo: d.photo, help_phone: normalised, help_name: d.helpName || null })
      d.setPatient(id, token)
      d.setJoin(join_token)
      d.setHelpConfirmed(false)
      void requestBriefing(id)
      nav('/setup/check')
    } catch {
      setError('Could not save. Check the internet and try again.')
    } finally { setBusy(false) }
  }

  return (
    <SetupShell step={3} back="/setup/me" title="Help person"
      footer={<PillButton size="lg" disabled={!normalised || busy} onClick={next}>{busy ? 'Saving' : 'Next'}</PillButton>}>
      <div className="flex items-center gap-5">
        <img src={UI.helpFamily} alt="Family who will help you" width={220} height={220} className="h-36 w-36 rounded-[28px] object-cover shadow-soft sm:h-44 sm:w-44" />
        <p className="max-w-[12rem] text-lg font-semibold leading-snug">If you need help, we tell them.</p>
      </div>
      <Dialpad value={d.helpPhone} onChange={(v) => { setError(''); d.setHelp({ helpPhone: v }) }} />
      {error && <p role="alert" className="text-center font-semibold text-alert">{error}</p>}
      {canPick && (
        <button onClick={pick} className="inline-flex min-h-14 items-center gap-2 rounded-full border border-line bg-white px-6 font-semibold"><Contact size={20} aria-hidden /> Pick from contacts</button>
      )}
      <label className="w-full max-w-xs text-sm font-semibold text-muted">
        Their name (optional)
        <input value={d.helpName} onChange={(e) => d.setHelp({ helpName: e.target.value })} maxLength={40} className="mt-1 w-full rounded-full border border-line bg-white px-5 py-2.5 text-base text-ink outline-none focus:border-ember" />
      </label>
    </SetupShell>
  )
}
