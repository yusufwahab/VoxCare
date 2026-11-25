import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Eyebrow, Page, PictureCard, PillButton } from '../ui'
import { UI } from '../../data/assets'
import { realtimeConfigured } from '../../lib/supabase'
import type { VisitMode } from '../../visit/events'

const KEY = 'vc-visit-mode'

/** The doctor's last choice, so the same one is ready next time */
export function lastMode(): VisitMode {
  try { return localStorage.getItem(KEY) === 'two' && realtimeConfigured ? 'two' : 'one' } catch { return 'one' }
}

/** "How will you talk to the patient?" Two big picture cards. */
export function ModeChoice({ who, busy, onBack, onChoose }: { who: string; busy?: boolean; onBack: () => void; onChoose: (m: VisitMode) => void }) {
  const [mode, setMode] = useState<VisitMode>(lastMode)
  const choose = () => {
    try { localStorage.setItem(KEY, mode) } catch { /* ignore */ }
    onChoose(mode)
  }
  return (
    <Page className="grid min-h-dvh place-items-center bg-ivory px-5 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <button onClick={onBack} aria-label="Back" className="grid h-12 w-12 place-items-center rounded-full bg-sand"><ArrowLeft aria-hidden /></button>
          <Eyebrow>{who}</Eyebrow>
        </div>
        <h1 className="h2 mb-8 text-center">How will you talk to the patient?</h1>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="text-center">
            <PictureCard src={UI.hospitalTablet} label="One device" size="lg" selected={mode === 'one'} onClick={() => setMode('one')} />
            <p className="mt-1 text-muted">Patient is with me</p>
          </div>
          <div className="text-center">
            <PictureCard src={UI.talkDoctor} label="Two devices" size="lg" selected={mode === 'two'} onClick={() => realtimeConfigured && setMode('two')} className={realtimeConfigured ? '' : 'opacity-50'} />
            <p className="mt-1 text-muted">{realtimeConfigured ? 'Patient uses their own phone' : 'Needs Supabase keys in the frontend settings'}</p>
          </div>
        </div>
        <div className="mt-10 flex justify-center">
          <PillButton size="lg" onClick={choose} disabled={busy}>{busy ? 'Starting' : 'Start visit'}</PillButton>
        </div>
      </div>
    </Page>
  )
}
