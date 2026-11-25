import { useCallback, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCw, X } from 'lucide-react'
import { BODY } from '../data/assets'
import { detectRegion, REGIONS, type Region, type View } from '../lib/regions'
import type { Pin } from '../visit/events'

export type { Pin }

interface Props {
  view: View
  onViewChange?: (v: View) => void
  pins: Pin[]
  onPinsChange?: (pins: Pin[]) => void
  /** Called after any tap that lands on the body. Return true to stop the default pin drop. */
  onTap?: (x: number, y: number, region: Region | null) => boolean | void
  overlay?: ReactNode
  height?: string
  maxPins?: number
  readOnly?: boolean
  showFlip?: boolean
  showLabels?: boolean
  className?: string
}

const STAGE_BG = '#1b1f2a'
const debugOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'regions'

export function BodyMap({
  view, onViewChange, pins, onPinsChange, onTap, overlay, height = 'min(72vh, 780px)', maxPins = 3,
  readOnly, showFlip = true, showLabels = true, className,
}: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState<string | null>(null)
  const dragging = useRef<string | null>(null)
  const visible = pins.filter((p) => p.view === view)

  const toPct = useCallback((clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect()
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 }
  }, [])

  const handleTap = (e: React.PointerEvent) => {
    if (readOnly || dragging.current) return
    const { x, y } = toPct(e.clientX, e.clientY)
    const region = detectRegion(view, x, y)
    if (onTap?.(x, y, region)) return
    if (!region) {
      setHint('Tap on the body')
      setTimeout(() => setHint(null), 1400)
      return
    }
    if (!onPinsChange) return
    if (pins.length >= maxPins) {
      setHint(`Up to ${maxPins} places`)
      setTimeout(() => setHint(null), 1600)
      return
    }
    onPinsChange([...pins, { id: crypto.randomUUID(), view, x, y, regionName: region.name }])
  }

  const startDrag = (e: React.PointerEvent, id: string) => {
    if (readOnly) return
    e.stopPropagation()
    dragging.current = id
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const moveDrag = (e: React.PointerEvent, id: string) => {
    if (dragging.current !== id || !onPinsChange) return
    const { x, y } = toPct(e.clientX, e.clientY)
    const cx = Math.min(100, Math.max(0, x))
    const cy = Math.min(100, Math.max(0, y))
    const region = detectRegion(view, cx, cy)
    onPinsChange(pins.map((p) => (p.id === id ? { ...p, x: cx, y: cy, regionName: region?.name ?? p.regionName } : p)))
  }
  const endDrag = () => setTimeout(() => (dragging.current = null), 0)

  return (
    <div className={className} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        ref={stage}
        onPointerDown={handleTap}
        className="relative aspect-[2/3] touch-none select-none overflow-hidden rounded-[28px] shadow-soft"
        style={{ height, background: STAGE_BG, cursor: readOnly ? 'default' : 'crosshair' }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={view}
            src={view === 'front' ? BODY.front : BODY.back}
            alt={view === 'front' ? 'Front of the body' : 'Back of the body'}
            width={1024} height={1536}
            draggable={false}
            initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 h-full w-full object-fill"
          />
        </AnimatePresence>

        {overlay}

        {debugOn() && <DebugOverlay view={view} />}

        <AnimatePresence>
          {visible.map((p) => (
            <PinMark key={p.id} pin={p} showLabel={showLabels}
              onRemove={readOnly || !onPinsChange ? undefined : () => onPinsChange(pins.filter((q) => q.id !== p.id))}
              onDown={(e) => startDrag(e, p.id)} onMove={(e) => moveDrag(e, p.id)} onUp={endDrag} readOnly={readOnly} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {hint && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-ivory">
              {hint}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showFlip && onViewChange && (
        <button
          onClick={() => onViewChange(view === 'front' ? 'back' : 'front')}
          aria-label={view === 'front' ? 'Show the back' : 'Show the front'}
          className="glass absolute right-3 top-3 z-10 flex h-14 items-center gap-2 rounded-full px-4 font-semibold text-ivory"
        >
          <RotateCw size={20} aria-hidden />
          <span>{view === 'front' ? 'Back' : 'Front'}</span>
        </button>
      )}
    </div>
  )
}

function PinMark({ pin, onDown, onMove, onUp, onRemove, showLabel, readOnly }: {
  pin: Pin; onDown: (e: React.PointerEvent) => void; onMove: (e: React.PointerEvent) => void; onUp: () => void
  onRemove?: () => void; showLabel: boolean; readOnly?: boolean
}) {
  const below = pin.y < 14
  return (
    <motion.div
      className="absolute"
      style={{ left: `${pin.x}%`, top: `${pin.y}%`, width: 0, height: 0 }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.6 }}
    >
      <span className="glow pointer-events-none absolute -left-[70px] -top-[70px] h-[140px] w-[140px]" />
      <span className="pulse-ring pointer-events-none absolute -left-[26px] -top-[26px] h-[52px] w-[52px]" />
      <motion.span
        initial={{ y: -70, scale: 0.4, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 14, mass: 0.7 }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        role="img" aria-label={`Pain pin: ${pin.regionName}`}
        className="absolute -left-[22px] -top-[22px] block h-11 w-11 touch-none rounded-full"
        style={{ cursor: readOnly ? 'default' : 'grab' }}
      >
        <span className="absolute inset-[9px] rounded-full border-[3px] border-ivory bg-ember shadow-[0_0_0_4px_rgba(232,131,58,0.35)]" />
      </motion.span>
      {showLabel && (
        <motion.div
          initial={{ opacity: 0, y: below ? -6 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass absolute left-0 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full py-1.5 pl-3.5 pr-2 text-sm font-semibold text-ivory"
          style={below ? { top: 30 } : { bottom: 30 }}
        >
          {pin.regionName}
          {onRemove && (
            <button onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} aria-label={`Remove pin on ${pin.regionName}`}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
              <X size={14} aria-hidden />
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

/** Hidden calibration overlay: open any body map with ?debug=regions */
function DebugOverlay({ view }: { view: View }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {REGIONS[view].map((r, i) => (
        <g key={r.id}>
          <polygon points={r.polygon.map((p) => p.join(',')).join(' ')} fill={`hsla(${(i * 47) % 360},90%,60%,0.18)`} stroke={`hsl(${(i * 47) % 360},90%,65%)`} strokeWidth="0.25" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  )
}

/** Small read-only mannequin with glowing pins, for the doctor panel, cards and landing page */
export function MiniBody({ pins, view = 'front', height = '220px' }: { pins: Pin[]; view?: View; height?: string }) {
  return <BodyMap view={view} pins={pins} readOnly showFlip={false} showLabels={false} height={height} />
}
