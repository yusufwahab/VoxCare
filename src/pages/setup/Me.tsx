import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { Camera, Image as ImageIcon, User } from 'lucide-react'
import { SetupShell } from '../../components/SetupShell'
import { FullScreen, PillButton } from '../../components/ui'
import { UI } from '../../data/assets'
import { useDevice } from '../../store/device'

/** Shrink a photo so it stays small to store and send */
function toDataUrl(source: CanvasImageSource, w: number, h: number): string {
  const size = 480
  const scale = Math.min(1, size / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

export default function Me() {
  const nav = useNavigate()
  const { photo, name, setMe } = useDevice()
  const [camera, setCamera] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const onFile = (f?: File) => {
    if (!f) return
    const img = new Image()
    img.onload = () => { setMe({ photo: toDataUrl(img, img.width, img.height) }); URL.revokeObjectURL(img.src) }
    img.src = URL.createObjectURL(f)
  }

  return (
    <SetupShell step={2} back="/start" title="Your photo"
      footer={<>
        <PillButton size="lg" onClick={() => nav('/setup/help')}>{photo ? 'Next' : 'Skip'}</PillButton>
        {photo && <button onClick={() => setMe({ photo: null })} className="min-h-12 text-sm font-semibold text-muted underline-offset-4 hover:underline">Remove photo</button>}
      </>}>
      <div className="flex items-center gap-6">
        <div className="grid h-56 w-56 place-items-center overflow-hidden rounded-full bg-sand shadow-soft ring-4 ring-white sm:h-64 sm:w-64">
          {photo ? <img src={photo} alt="Your photo" width={256} height={256} className="h-full w-full object-cover" /> : <User size={96} className="text-muted" aria-label="No photo yet" />}
        </div>
        <img src={UI.setupPhoto} alt="A person takes a photo of themselves" width={160} height={160} className="hidden h-40 w-40 rounded-[28px] object-cover shadow-soft sm:block" />
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        <button onClick={() => setCamera(true)} className="flex flex-col items-center gap-3 rounded-[24px] bg-white p-4 shadow-soft transition-transform active:scale-[0.97]">
          <img src={UI.photoCamera} alt="" width={160} height={160} className="aspect-square w-full rounded-[20px] object-cover" />
          <span className="flex items-center gap-2 text-lg font-semibold"><Camera size={20} aria-hidden /> Camera</span>
        </button>
        <button onClick={() => file.current?.click()} className="flex flex-col items-center gap-3 rounded-[24px] bg-white p-4 shadow-soft transition-transform active:scale-[0.97]">
          <img src={UI.photoGallery} alt="" width={160} height={160} className="aspect-square w-full rounded-[20px] object-cover" />
          <span className="flex items-center gap-2 text-lg font-semibold"><ImageIcon size={20} aria-hidden /> Gallery</span>
        </button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <label className="w-full max-w-xs text-sm font-semibold text-muted">
        Name (optional)
        <input value={name} onChange={(e) => setMe({ name: e.target.value })} maxLength={40} autoComplete="given-name" className="mt-1 w-full rounded-full border border-line bg-white px-5 py-2.5 text-base text-ink outline-none focus:border-ember" />
      </label>
      <AnimatePresence>{camera && <CameraCapture onClose={() => setCamera(false)} onCapture={(url) => { setMe({ photo: url }); setCamera(false) }} />}</AnimatePresence>
    </SetupShell>
  )
}

function CameraCapture({ onCapture, onClose }: { onCapture: (url: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play() } })
      .catch(() => setErr(true))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  const snap = () => {
    const v = video.current!
    const side = Math.min(v.videoWidth, v.videoHeight)
    const c = document.createElement('canvas')
    c.width = c.height = Math.min(480, side)
    c.getContext('2d')!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, c.width, c.height)
    onCapture(c.toDataURL('image/jpeg', 0.82))
  }

  return (
    <FullScreen tone="dark" onClose={onClose}>
      {err ? <p className="max-w-sm text-center text-lg">The camera is not available. Use Gallery or Skip.</p> : (
        <>
          <div className="aspect-square w-full max-w-sm overflow-hidden rounded-full bg-black ring-4 ring-white/30">
            <video ref={video} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          </div>
          <button onClick={snap} aria-label="Take photo" className="grid h-24 w-24 place-items-center rounded-full border-4 border-ivory bg-ember shadow-lift active:scale-95">
            <Camera size={36} className="text-ink" aria-hidden />
          </button>
        </>
      )}
    </FullScreen>
  )
}
