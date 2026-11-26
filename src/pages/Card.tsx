import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Nfc, Printer, User } from 'lucide-react'
import { SetupShell } from '../components/SetupShell'
import { PillButton } from '../components/ui'
import { VoxCard, cardUrl } from '../components/VoxCard'
import { UI } from '../data/assets'
import { useDevice } from '../store/device'
import { nfcSupported } from '../components/Scanner'
import { TAG } from '../lib/brand'

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
      setMsg(`Done. Your ${TAG} is ready.`)
    } catch { setMsg(`Could not write. Hold the ${TAG} to the back of the phone and try again.`) }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMsg('Link copied.') } catch { setMsg(url) } }

  return (
    <SetupShell step={4} total={4} title="Your card"
      footer={<PillButton size="lg" onClick={() => nav('/home')}>Go home</PillButton>}>
      <VoxCard patientId={patientId} name={name} photo={photo} />

      {/* A picture that explains the tag. It is not a button. */}
      <div className="flex w-full max-w-md items-center gap-4 rounded-[24px] bg-sand/70 p-4">
        <img src={UI.nfcTap} alt={`A phone taps a ${TAG}`} width={180} height={180} className="h-24 w-24 shrink-0 rounded-[20px] object-cover" />
        <div>
          <p className="text-lg font-semibold leading-snug">In an emergency, a phone taps your {TAG}</p>
          <p className="mt-0.5 text-sm text-muted">It opens your card and tells your help person.</p>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        {nfcSupported() ? (
          <PillButton variant="dark" icon={<Nfc size={20} />} onClick={writeNfc}>Write to my {TAG}</PillButton>
        ) : (
          <div className="rounded-[20px] bg-sand p-4 text-center text-sm text-muted">
            Writing to a {TAG} needs Android Chrome. On other phones, use a free NFC writer app and save this link on the tag.
            <button onClick={copy} className="mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-ink"><Copy size={16} aria-hidden /> Copy link</button>
          </div>
        )}
        <PillButton variant="outline" icon={<Printer size={20} />} onClick={() => window.print()}>Print my QR code</PillButton>
      </div>

      {!helpConfirmed && (
        <p role="status" className="flex items-center gap-3 text-lg font-semibold text-muted"><span className="glow inline-block h-6 w-6" aria-hidden /> Waiting for your help person</p>
      )}
      {msg && <p role="status" className="text-center font-semibold text-verified">{msg}</p>}
      <Link to="/e/demo" className="sr-only">Emergency page preview</Link>

      {createPortal(<PrintSheet url={url} name={name} photo={photo} />, document.body)}
    </SetupShell>
  )
}

/** What comes out of the printer: a big QR code a responder can scan from a wallet, a phone case or a door */
function PrintSheet({ url, name, photo }: { url: string; name: string; photo: string | null }) {
  return (
    <div className="print-only" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, minHeight: '90vh', textAlign: 'center', fontFamily: 'Arial, Helvetica, sans-serif', color: '#24140E' }}>
      <div style={{ letterSpacing: 4, fontSize: 14, fontWeight: 700 }}>VOXCARE</div>
      {photo
        ? <img src={photo} alt="" width={120} height={120} style={{ width: 120, height: 120, borderRadius: 60, objectFit: 'cover' }} />
        : <span style={{ display: 'inline-flex', width: 120, height: 120, borderRadius: 60, background: '#F2E5D2', alignItems: 'center', justifyContent: 'center' }}><User size={56} color="#7A685B" /></span>}
      <div style={{ fontSize: 34, fontWeight: 700 }}>{name || 'Emergency card'}</div>
      <div style={{ fontSize: 20, fontWeight: 700, background: '#D64531', color: '#fff', padding: '8px 22px', borderRadius: 999 }}>DEAF · CANNOT SPEAK</div>
      <QRCodeSVG value={url} size={300} fgColor="#000000" bgColor="#ffffff" level="M" />
      <div style={{ fontSize: 20, maxWidth: 420, lineHeight: 1.4 }}>In an emergency, scan this code with any phone to see their information and alert their family.</div>
      <div style={{ fontSize: 12, color: '#7A685B', wordBreak: 'break-all', maxWidth: 420 }}>{url}</div>
    </div>
  )
}
