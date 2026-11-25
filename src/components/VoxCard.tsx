import { QRCodeSVG } from 'qrcode.react'
import { User } from 'lucide-react'

export const cardUrl = (patientId: string) => `${window.location.origin}/e/${patientId}`

/** The VoxCare card as a beautiful object */
export function VoxCard({ patientId, name, photo, mini }: { patientId: string; name?: string; photo?: string | null; mini?: boolean }) {
  const url = cardUrl(patientId)
  return (
    <div className="relative w-full overflow-hidden rounded-[28px] p-6 text-ivory shadow-soft" style={{ background: 'var(--warm-gradient)', aspectRatio: '1.586 / 1', maxWidth: mini ? 360 : 460 }}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber/30 blur-3xl" aria-hidden />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ivory/80">VoxCare</span>
          <span className="rounded-full border border-white/40 bg-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em]">Deaf · uses pictures</span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/50 sm:h-20 sm:w-20">
              {photo ? <img src={photo} alt={name || 'Card owner'} width={80} height={80} className="h-full w-full object-cover" /> : <User size={34} className="text-ivory/80" aria-label="No photo" />}
            </span>
            <span className="min-w-0 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name || 'My card'}</span>
          </div>
          <span className="shrink-0 rounded-2xl bg-ivory p-2 shadow-lift" role="img" aria-label="QR code for emergency information">
            <QRCodeSVG aria-hidden value={url} size={mini ? 72 : 96} fgColor="#24140E" bgColor="#FBF6EE" level="M" />
          </span>
        </div>
      </div>
    </div>
  )
}
