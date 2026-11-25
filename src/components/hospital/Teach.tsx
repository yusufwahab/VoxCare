import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { BodyMap } from '../BodyMap'
import { ClipCard, FullScreen, Page, PillButton } from '../ui'
import { detectRegion } from '../../lib/regions'
import { UI } from '../../data/assets'

/** Teach step 1: a looping clip shows how to tap */
export function TeachClip({ onNext }: { onNext: () => void }) {
  return (
    <Page className="grid min-h-dvh place-items-center bg-ivory p-5">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        <div className="aspect-video w-full overflow-hidden rounded-[28px] bg-sand shadow-soft">
          <ClipCard src={UI.demoTap} poster={UI.demoTapPoster} alt="A hand taps the body on the screen" />
        </div>
        <PillButton size="lg" ariaLabel="Next" onClick={onNext}>Next</PillButton>
      </div>
    </Page>
  )
}

/** Teach step 2: practice tap on the head with an animated hand */
export function PracticeTap({ onDone }: { onDone: () => void }) {
  const [glow, setGlow] = useState<{ x: number; y: number } | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(onDone, 1000)
    return () => clearTimeout(t)
  }, [done, onDone])

  return (
    <Page className="grid min-h-dvh place-items-center bg-ivory p-4">
      <div className="flex flex-col items-center gap-5">
        <BodyMap view="front" pins={[]} readOnly={false} showFlip={false} height="min(74vh, 780px)"
          onTap={(x, y) => {
            if (done) return true
            const r = detectRegion('front', x, y)
            if (!r || !/^(head|face|jaw)-/.test(r.id)) return true
            setGlow({ x, y })
            setTimeout(() => setDone(true), 450)
            return true
          }}
          overlay={
            <>
              {/* head highlight */}
              <span className="pointer-events-none absolute left-[50.5%] top-[14.5%] block h-[17%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber/70" style={{ boxShadow: '0 0 40px 6px rgba(232,131,58,.45)' }} />
              <span className="pulse-ring pointer-events-none absolute left-[50.5%] top-[15%] block h-[20%] w-[32%] -translate-x-1/2 -translate-y-1/2" />
              {!glow && (
                <span className="pointer-events-none absolute left-[50.5%] top-[15%]" style={{ animation: 'tap-hand 2.4s ease-in-out infinite' }} aria-hidden>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FBF6EE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.6))' }}>
                    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-3a1.5 1.5 0 0 1 3 0v6.5A6.5 6.5 0 0 1 11.5 20h-1A6.5 6.5 0 0 1 6 18l-2.6-4.3a1.5 1.5 0 0 1 2.4-1.7L9 14" fill="rgba(251,246,238,.15)" />
                  </svg>
                </span>
              )}
              {glow && <span className="glow pointer-events-none absolute block h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${glow.x}%`, top: `${glow.y}%` }} />}
            </>
          }
        />
        <p className="h3 text-center">Tap the head</p>
      </div>
      <AnimatePresence>
        {done && (
          <FullScreen>
            <img src={UI.practiceDone} alt="Well done" width={900} height={900} className="max-h-[80vh] w-auto rounded-[28px] object-contain shadow-soft" />
          </FullScreen>
        )}
      </AnimatePresence>
    </Page>
  )
}
