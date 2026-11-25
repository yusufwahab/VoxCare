import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, X } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Small uppercase mono label inside a thin outlined pill */
export function Eyebrow({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em]',
        tone === 'light' ? 'border-white/35 bg-white/10 text-ivory' : 'border-line bg-ivory text-cocoa',
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-ember" aria-hidden />
      {children}
    </span>
  )
}

type Variant = 'ember' | 'ivory' | 'dark' | 'outline' | 'ghost-light'
interface PillProps {
  children: ReactNode
  to?: string
  onClick?: () => void
  variant?: Variant
  icon?: ReactNode
  /** hide the circular icon chip */
  noIcon?: boolean
  disabled?: boolean
  size?: 'md' | 'lg'
  className?: string
  ariaLabel?: string
  type?: 'button' | 'submit'
}

const VARIANTS: Record<Variant, { btn: string; chip: string }> = {
  ember: { btn: 'bg-ember text-ink shadow-lift hover:bg-amber', chip: 'bg-ink text-ivory' },
  ivory: { btn: 'bg-ivory text-ink shadow-lift hover:bg-white', chip: 'bg-cocoa text-ivory' },
  dark: { btn: 'bg-ink text-ivory hover:bg-cocoa', chip: 'bg-ember text-ink' },
  outline: { btn: 'border border-line bg-transparent text-ink hover:bg-sand', chip: 'bg-sand text-cocoa' },
  'ghost-light': { btn: 'border border-white/40 bg-white/5 text-ivory hover:bg-white/15', chip: 'bg-white/20 text-ivory' },
}

export function PillButton({ children, to, onClick, variant = 'ember', icon, noIcon, disabled, size = 'md', className, ariaLabel, type = 'button' }: PillProps) {
  const v = VARIANTS[variant]
  const cls = cx(
    'group inline-flex items-center justify-between gap-3 rounded-full font-semibold transition-colors select-none',
    size === 'lg' ? 'min-h-16 pl-7 pr-2 text-lg' : 'min-h-14 pl-6 pr-1.5 text-base',
    v.btn,
    disabled && 'pointer-events-none opacity-40',
    className,
  )
  const chip = noIcon ? <span className="w-4" /> : (
    <span className={cx('grid shrink-0 place-items-center rounded-full transition-transform group-hover:translate-x-0.5', size === 'lg' ? 'h-12 w-12' : 'h-11 w-11', v.chip)}>
      {icon ?? <ArrowRight size={20} aria-hidden />}
    </span>
  )
  const inner = <>{children}{chip}</>
  if (to) return <Link to={to} className={cls} aria-label={ariaLabel}>{inner}</Link>
  return (
    <motion.button whileTap={{ scale: 0.97 }} type={type} onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel}>
      {inner}
    </motion.button>
  )
}

/** Frosted card for use on top of photos */
export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('glass rounded-[20px] text-ivory', className)}>{children}</div>
}

interface PictureCardProps {
  src: string
  label: string
  selected?: boolean
  onClick?: () => void
  /** clip: show looping muted video when visible */
  clip?: string
  poster?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  alt?: string
  badge?: ReactNode
}

/** Core patient component: a square real photo with a 1-3 word label */
export function PictureCard({ src, label, selected, onClick, clip, poster, className, size = 'md', alt, badge }: PictureCardProps) {
  const min = size === 'lg' ? 'min-w-[160px]' : size === 'sm' ? 'min-w-[96px]' : 'min-w-[132px]'
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cx('group flex w-full flex-col items-center gap-2.5 text-center', min, className)}
    >
      <span
        className={cx(
          'relative block aspect-square w-full overflow-hidden rounded-[24px] bg-sand shadow-soft transition-all',
          selected ? 'ring-[5px] ring-ember ring-offset-2 ring-offset-ivory' : 'ring-0 group-hover:shadow-lift',
        )}
      >
        {clip ? <ClipCard src={clip} poster={poster ?? src} alt={alt ?? label} /> : (
          <img src={src} alt={alt ?? label} width={512} height={512} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        )}
        {selected && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-ember text-ink shadow-lift">
            <Check size={20} strokeWidth={3} aria-hidden />
          </motion.span>
        )}
        {badge}
      </span>
      <span className="text-[17px] font-semibold leading-tight tracking-tight">{label}</span>
    </motion.button>
  )
}

/** Muted looping clip; plays only while visible */
export function ClipCard({ src, poster, alt, className }: { src: string; poster: string; alt: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const v = ref.current
    if (!v || reduce) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {})
        else v.pause()
      },
      { threshold: 0.4 },
    )
    io.observe(v)
    return () => io.disconnect()
  }, [reduce])
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      className={cx('h-full w-full object-cover', className)}
    />
  )
}

/** Huge tick and cross for yes / no answers */
export function AnswerButtons({ onYes, onNo, yesLabel = 'Yes', noLabel = 'No', size = 140 }: { onYes: () => void; onNo: () => void; yesLabel?: string; noLabel?: string; size?: number }) {
  const big = { width: size, height: size }
  return (
    <div className="flex items-start justify-center gap-8 sm:gap-14">
      <motion.button whileTap={{ scale: 0.93 }} onClick={onYes} aria-label={yesLabel} className="flex flex-col items-center gap-3">
        <span style={big} className="grid place-items-center rounded-full bg-verified text-white shadow-lift">
          <Check size={size * 0.5} strokeWidth={3.2} aria-hidden />
        </span>
        <span className="text-lg font-semibold text-verified">{yesLabel}</span>
      </motion.button>
      <motion.button whileTap={{ scale: 0.93 }} onClick={onNo} aria-label={noLabel} className="flex flex-col items-center gap-3">
        <span style={big} className="grid place-items-center rounded-full bg-alert text-white shadow-lift">
          <X size={size * 0.5} strokeWidth={3.2} aria-hidden />
        </span>
        <span className="text-lg font-semibold text-alert">{noLabel}</span>
      </motion.button>
    </div>
  )
}

export function Badge({ kind, children }: { kind: 'verified' | 'self' | 'alert'; children: ReactNode }) {
  const map = {
    verified: 'bg-verified-bg text-verified',
    self: 'bg-self-bg text-self',
    alert: 'bg-alert text-white',
  }
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em]', map[kind])}>{children}</span>
}

/** Page wrapper with a gentle entrance */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className={className}>
      {children}
    </motion.main>
  )
}

export function Dots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx('h-2.5 rounded-full transition-all', i + 1 === step ? 'w-8 bg-ember' : i + 1 < step ? 'w-2.5 bg-ember/60' : 'w-2.5 bg-line')} />
      ))}
    </div>
  )
}

/** Fullscreen overlay used to show a picture to the patient */
export function FullScreen({ children, onClose, tone = 'ivory' }: { children: ReactNode; onClose?: () => void; tone?: 'ivory' | 'dark' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className={cx('fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-y-auto p-6', tone === 'dark' ? 'bg-ink text-ivory' : 'bg-ivory text-ink')}
      role="dialog" aria-modal="true"
    >
      {onClose && (
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-sand text-ink">
          <X size={22} aria-hidden />
        </button>
      )}
      {children}
    </motion.div>
  )
}

export function useBool(initial = false) {
  const [v, set] = useState(initial)
  return [v, () => set(true), () => set(false), set] as const
}
