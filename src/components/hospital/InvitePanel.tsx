import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, MessageCircle } from 'lucide-react'
import { Eyebrow } from '../ui'
import { useVisit } from '../../visit/store'
import { whatsappLink } from '../../lib/whatsapp'

export const joinLink = (visitId: string, code: string) => `${window.location.origin}/v/${visitId}?role=patient&code=${code}`

/** How the patient gets into a two-device visit: scan, type the code, or open a link (WhatsApp or copied) */
export function InvitePanel() {
  const { visitId, code } = useVisit()
  const [copied, setCopied] = useState(false)
  if (!visitId || !code) return null
  const link = joinLink(visitId, code)

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { window.prompt('Copy this link', link) }
  }

  return (
    <section className="rounded-[24px] border border-line bg-white p-5 shadow-soft" aria-label="Invite the patient">
      <Eyebrow>Invite the patient</Eyebrow>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="rounded-2xl bg-ivory p-3" aria-label="QR code to join the visit">
          <QRCodeSVG value={link} size={148} fgColor="#24140E" bgColor="#FBF6EE" level="M" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">Or open VoxCare on their phone and type</p>
          <p className="mt-1 text-5xl font-semibold tracking-[0.18em] tabular-nums" aria-label={`Code ${code.split('').join(' ')}`}>{code}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {/* No number: WhatsApp opens its own contact picker (or the demo number in demo mode) */}
            <a href={whatsappLink('', `Please join my VoxCare visit. Tap to join: ${link}`)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-verified px-5 font-semibold text-white">
              <MessageCircle size={18} aria-hidden /> Send link
            </a>
            <button onClick={copy} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-5 font-semibold">
              <Copy size={18} aria-hidden /> {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
