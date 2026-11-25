import { motion } from 'motion/react'
import { Minus, Plus } from 'lucide-react'
import { BODY, LEVELS } from '../data/assets'
import type { Duration, PainKind, PresetDuration } from '../lib/sentence'
import type { Pin } from './BodyMap'
import { cx } from './ui'

export const PAIN_KINDS: { id: PainKind; label: string }[] = [
  { id: 'pressing', label: 'Pressing' },
  { id: 'burning', label: 'Burning' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'throbbing', label: 'Throbbing' },
  { id: 'cramping', label: 'Cramping' },
]

/** The glow effect for each kind of pain, drawn on a transparent layer centred on (0,0). */
function KindGlow({ kind }: { kind: PainKind }) {
  switch (kind) {
    case 'pressing':
      return <span className="absolute -left-[110px] -top-[110px] block h-[220px] w-[220px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(232,131,58,.85) 0%, rgba(232,131,58,.55) 40%, rgba(232,131,58,0) 72%)' }} />
    case 'burning':
      return (
        <>
          <span className="absolute -left-[70px] -top-[70px] block h-[140px] w-[140px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(244,178,99,.95) 0%, rgba(232,131,58,.7) 35%, rgba(232,131,58,0) 70%)', animation: 'flicker 0.9s steps(6,end) infinite' }} />
          <span className="absolute -left-[38px] -top-[38px] block h-[76px] w-[76px] rounded-full" style={{ background: 'radial-gradient(circle, #F4B263 0%, rgba(232,131,58,.0) 70%)', animation: 'flicker 0.6s steps(5,end) infinite reverse' }} />
        </>
      )
    case 'sharp':
      return (
        <>
          <span className="absolute -left-[80px] -top-[80px] block h-[160px] w-[160px] rounded-full" style={{ background: 'repeating-conic-gradient(from 0deg, rgba(244,178,99,.95) 0deg 3deg, transparent 3deg 45deg)', WebkitMaskImage: 'radial-gradient(circle, #000 8%, transparent 68%)', maskImage: 'radial-gradient(circle, #000 8%, transparent 68%)' }} />
          <span className="absolute -left-[11px] -top-[11px] block h-[22px] w-[22px] rounded-full bg-amber" style={{ boxShadow: '0 0 18px 6px rgba(244,178,99,.95)' }} />
        </>
      )
    case 'throbbing':
      return (
        <>
          {[0, 0.5, 1].map((d) => (
            <span key={d} className="absolute -left-[75px] -top-[75px] block h-[150px] w-[150px] rounded-full border-[3px] border-amber" style={{ animation: `ring-out 1.5s ease-out ${d}s infinite` }} />
          ))}
          <span className="absolute -left-[14px] -top-[14px] block h-[28px] w-[28px] rounded-full bg-ember" style={{ boxShadow: '0 0 20px 6px rgba(232,131,58,.9)' }} />
        </>
      )
    case 'cramping':
      return (
        <span className="absolute -left-[70px] -top-[70px] block h-[140px] w-[140px]" style={{ animation: 'twist 2.4s linear infinite' }}>
          <span className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(232,131,58,.95), rgba(232,131,58,0) 30%, rgba(244,178,99,.9) 50%, rgba(244,178,99,0) 80%, rgba(232,131,58,.95))', WebkitMaskImage: 'radial-gradient(circle, transparent 10%, #000 28%, transparent 70%)', maskImage: 'radial-gradient(circle, transparent 10%, #000 28%, transparent 70%)', transform: 'scaleX(0.8)' }} />
        </span>
      )
  }
}

/** A cropped, zoomed live view of the mannequin at the pin with the glow for this kind of pain */
export function PainCrop({ pin, kind }: { pin: Pin; kind: PainKind }) {
  const zoom = 2.3
  // Image is zoom x box wide and 1.5 * zoom x box tall. Centre the pin, clamped so we never show empty space.
  const px = pin.x / 100
  const py = pin.y / 100
  const posX = clamp(((0.5 - zoom * px) / (1 - zoom)) * 100, 0, 100)
  const posY = clamp(((0.5 - zoom * 1.5 * py) / (1 - zoom * 1.5)) * 100, 0, 100)
  // Where the pin ends up inside the box (fractions of the box)
  const pinLeft = (posX / 100) * (1 - zoom) + zoom * px
  const pinTop = (posY / 100) * (1 - zoom * 1.5) + zoom * 1.5 * py
  return (
    <span className="relative block aspect-square w-full overflow-hidden rounded-[24px] shadow-soft" style={{ background: '#1b1f2a' }}>
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${pin.view === 'front' ? BODY.front : BODY.back})`,
          backgroundSize: `${zoom * 100}% ${zoom * 150}%`,
          backgroundPosition: `${posX}% ${posY}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
      <span className="absolute" style={{ left: `${pinLeft * 100}%`, top: `${pinTop * 100}%` }}><KindGlow kind={kind} /></span>
    </span>
  )
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

export function PainKindPicker({ pin, value, onChange }: { pin: Pin; value?: PainKind; onChange: (k: PainKind) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-5 sm:grid-cols-3">
      {PAIN_KINDS.map((k) => (
        <motion.button key={k.id} type="button" whileTap={{ scale: 0.97 }} onClick={() => onChange(k.id)} aria-pressed={value === k.id} className="flex flex-col items-center gap-2.5">
          <span className={cx('block w-full rounded-[28px] transition-all', value === k.id && 'ring-[5px] ring-ember ring-offset-2 ring-offset-ivory')}>
            <PainCrop pin={pin} kind={k.id} />
          </span>
          <span className="text-[17px] font-semibold">{k.label}</span>
        </motion.button>
      ))}
    </div>
  )
}

/** Five faces in a row with a warm gradient bar underneath */
export function LevelPicker({ value, onChange }: { value?: number; onChange: (n: number) => void }) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-5 gap-2 sm:gap-4">
        {LEVELS.map((l, i) => (
          <motion.button key={l.id} type="button" whileTap={{ scale: 0.95 }} onClick={() => onChange(i)} aria-pressed={value === i} aria-label={l.label} className="flex flex-col items-center gap-2">
            <span className={cx('block aspect-square w-full overflow-hidden rounded-[22px] bg-sand shadow-soft transition-all', value === i ? 'ring-[5px] ring-ember ring-offset-2 ring-offset-ivory' : value !== undefined && 'opacity-60')}>
              <img src={l.src} alt={l.label} width={256} height={256} loading="lazy" className="h-full w-full object-cover" />
            </span>
          </motion.button>
        ))}
      </div>
      <div className="mt-4 h-3 w-full rounded-full" style={{ background: 'linear-gradient(90deg, #F2E5D2, #F4B263 40%, #E8833A 72%, #D64531)' }} aria-hidden />
      <div className="mt-2 flex justify-between text-sm font-semibold text-muted"><span>A little</span><span>Worst</span></div>
    </div>
  )
}

const PRESETS: { key: PresetDuration; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 0 },
  { key: 'few', label: 'A few days', days: 3 },
  { key: 'week', label: 'A week', days: 7 },
  { key: 'longer', label: 'Longer', days: 14 },
]

export function DurationPicker({ value, onChange }: { value?: Duration; onChange: (d: Duration) => void }) {
  const days = value?.type === 'days' ? value.n : value?.type === 'preset' ? PRESETS.find((p) => p.key === value.key)!.days : 0
  const setDays = (n: number) => onChange({ type: 'days', n: clamp(n, 0, 60) })
  const stepBtn = 'grid h-20 w-20 place-items-center rounded-full bg-ink text-ivory shadow-lift active:scale-95'
  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex items-center gap-6 sm:gap-10">
        <button onClick={() => setDays(days - 1)} aria-label="One day less" className={stepBtn}><Minus size={34} aria-hidden /></button>
        <div className="min-w-[8.5rem] text-center" aria-live="polite">
          <div className="text-[5rem] font-semibold leading-none tracking-tight">{days}</div>
          <div className="mt-1 text-lg font-semibold text-muted">{days === 1 ? 'day' : 'days'}</div>
        </div>
        <button onClick={() => setDays(days + 1)} aria-label="One day more" className={stepBtn}><Plus size={34} aria-hidden /></button>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {PRESETS.map((p) => {
          const active = value?.type === 'preset' && value.key === p.key
          return (
            <button key={p.key} onClick={() => onChange({ type: 'preset', key: p.key })} aria-pressed={active}
              className={cx('min-h-14 rounded-full px-6 text-lg font-semibold transition-colors', active ? 'bg-ember text-ink' : 'border border-line bg-white hover:bg-sand')}>
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
