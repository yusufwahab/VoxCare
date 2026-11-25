import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Copy, Nfc } from 'lucide-react'
import { SetupShell } from '../components/SetupShell'
import { PillButton } from '../components/ui'
import { VoxCard, cardUrl } from '../components/VoxCard'
import { UI } from '../data/assets'
import { useDevice } from '../store/device'
import { nfcSupported } from '../components/Scanner'

export default function Card() {
  const nav = useNavigate()
  const { patientId, name, photo, helpConfirmed } = useDevice()
  const [msg, setMsg] = useState('')
  if (!patientId) return <Navigate to="/start" replace />
  const url = cardUrl(patientId)

  const writeNfc = async () => {
    try {
      const Ctor = (window as unknown as { NDEFReader: new () => { write: (m: unknown) => Promise<void> } }).NDEFReader
      await new Ctor().write({ records: [{ recordType: 'url', data: url }] })
      setMsg('Done. The sticker is ready.')
    } catch { setMsg('Could not write. Hold the sticker to the back of the phone and try again.') }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMsg('Link copied.') } catch { setMsg(url) } }

  return (
    <SetupShell step={4} total={4} title="Your card"
      footer={<PillButton size="lg" onClick={() => nav('/home')}>Go home</PillButton>}>
      <VoxCard patientId={patientId} name={name} photo={photo} />
      <div className="flex w-full max-w-md items-center gap-5 rounded-[24px] bg-white p-4 shadow-soft">
        <img src={UI.nfcTap} alt="A phone taps an NFC sticker" width={180} height={180} className="h-28 w-28 shrink-0 rounded-[20px] object-cover" />
        <p className="text-xl font-semibold leading-snug">Tap here in an emergency</p>
      </div>
      {nfcSupported() ? (
        <PillButton variant="dark" icon={<Nfc size={20} />} onClick={writeNfc} className="w-full max-w-md">Write to NFC sticker</PillButton>
      ) : (
        <div className="w-full max-w-md rounded-[20px] bg-sand p-4 text-center text-sm text-muted">
          NFC writing needs Android Chrome. On other phones, use a free NFC writer app and save this link on the sticker.
          <button onClick={copy} className="mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-ink"><Copy size={16} aria-hidden /> Copy link</button>
        </div>
      )}
      {!helpConfirmed && (
        <p role="status" className="flex items-center gap-3 text-lg font-semibold text-muted"><span className="glow inline-block h-6 w-6" aria-hidden /> Waiting for your help person</p>
      )}
      {msg && <p role="status" className="text-center font-semibold text-verified">{msg}</p>}
      <Link to="/e/demo" className="sr-only">Emergency page preview</Link>
    </SetupShell>
  )
}
