import { motion } from 'motion/react'
import { Delete } from 'lucide-react'

/** Big digits-only keypad, like a phone dialler */
export function Dialpad({ value, onChange, maxLength = 14, hideDisplay, noPlus }: { value: string; onChange: (v: string) => void; maxLength?: number; hideDisplay?: boolean; noPlus?: boolean }) {
  const press = (d: string) => value.length < maxLength && onChange(value + d)
  const keys = hideDisplay || noPlus ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'] : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0']
  return (
    <div className="mx-auto w-full max-w-[22rem]">
      {!hideDisplay && <div className="mb-4 flex min-h-[4.5rem] items-center justify-center rounded-[20px] border border-line bg-white px-4 text-center text-[2.25rem] font-semibold tracking-wide tabular-nums shadow-soft" aria-live="polite" aria-label="Number">
        {value || <span className="text-line">0 8 0 0 0 0 0 0 0 0 0</span>}
      </div>}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => k === '' ? <span key="gap" /> : (
          <motion.button key={k} whileTap={{ scale: 0.93 }} onClick={() => press(k)} aria-label={k === '+' ? 'Plus' : k}
            className="h-[4.5rem] rounded-[20px] bg-sand text-[1.75rem] font-semibold text-ink shadow-[0_2px_0_var(--color-line)] active:bg-amber/60">
            {k}
          </motion.button>
        ))}
        <motion.button whileTap={{ scale: 0.93 }} onClick={() => onChange(value.slice(0, -1))} aria-label="Delete last digit"
          className="grid h-[4.5rem] place-items-center rounded-[20px] bg-ink text-ivory">
          <Delete size={28} aria-hidden />
        </motion.button>
      </div>
    </div>
  )
}

/** Normalise Nigerian numbers: 0XXXXXXXXXX or +234XXXXXXXXXX -> digits with country code (234XXXXXXXXXX) */
export function normaliseNg(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '')
  if (/^0\d{10}$/.test(d)) return `234${d.slice(1)}`
  if (/^\+234\d{10}$/.test(d)) return d.slice(1)
  if (/^234\d{10}$/.test(d)) return d
  return null
}
