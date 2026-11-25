import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { FullScreen } from './ui'

/** Pull a patient id out of a card URL like https://host/e/<id> */
export function parsePatientId(text: string): string | null {
  const m = text.match(/\/e\/([A-Za-z0-9-]+)/)
  return m ? m[1] : null
}

/** QR scanner using the camera. Calls onResult with the first patient id found. */
export function Scanner({ onResult, onClose }: { onResult: (id: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromVideoDevice(undefined, video.current!, (res) => {
          const id = res ? parsePatientId(res.getText()) : null
          if (id && !cancelled) {
            cancelled = true
            controls.stop()
            onResult(id)
          }
        })
        stop = () => controls.stop()
      } catch {
        setError('Camera is not available. Allow the camera, or use the demo patient.')
      }
    })()
    return () => { cancelled = true; stop?.() }
  }, [onResult])

  return (
    <FullScreen tone="dark">
      <button onClick={onClose} aria-label="Close scanner" className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-white/15"><X aria-hidden /></button>
      <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-[28px] bg-black">
        <video ref={video} muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-8 rounded-[24px] border-2 border-amber/80" />
      </div>
      <p className="max-w-sm text-center text-lg">{error ?? 'Point the camera at the QR code on the card'}</p>
    </FullScreen>
  )
}

/** Read an NFC tag where Web NFC is supported (Android Chrome) */
export const nfcSupported = () => typeof window !== 'undefined' && 'NDEFReader' in window

export async function readNfc(): Promise<string | null> {
  type NDEFReaderLike = { scan: () => Promise<void>; onreading: ((e: { message: { records: { recordType: string; data: DataView }[] } }) => void) | null }
  const Ctor = (window as unknown as { NDEFReader: new () => NDEFReaderLike }).NDEFReader
  const r = new Ctor()
  await r.scan()
  return new Promise((resolve) => {
    r.onreading = (e) => {
      for (const rec of e.message.records) {
        const text = new TextDecoder().decode(rec.data)
        const id = parsePatientId(text)
        if (id) return resolve(id)
      }
      resolve(null)
    }
  })
}
