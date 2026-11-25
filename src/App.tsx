import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'motion/react'
import { DEMO_MODE } from './lib/whatsapp'

const Landing = lazy(() => import('./pages/Landing'))
const Hospital = lazy(() => import('./pages/Hospital'))
const Emergency = lazy(() => import('./pages/Emergency'))
const Consent = lazy(() => import('./pages/setup/Consent'))
const Me = lazy(() => import('./pages/setup/Me'))
const Help = lazy(() => import('./pages/setup/Help'))
const Check = lazy(() => import('./pages/setup/Check'))
const Card = lazy(() => import('./pages/Card'))
const Home = lazy(() => import('./pages/Home'))
const Join = lazy(() => import('./pages/Join'))
const TestEmail = lazy(() => import('./pages/dev/TestEmail'))

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ivory" role="status" aria-label="Loading">
      <span className="glow block h-24 w-24" />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  // reducedMotion="user": every motion animation follows the phone's "reduce motion" setting (spec §10).
  // CSS animations are handled in index.css.
  return (
    <MotionConfig reducedMotion="user">
    <Suspense fallback={<Loading />}>
      {DEMO_MODE && <span className="fixed bottom-3 left-3 z-[60] rounded-full border border-line bg-ivory/90 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-cocoa shadow-soft backdrop-blur">Demo mode</span>}
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname.split('/')[1]}>
          <Route path="/" element={<Landing />} />
          <Route path="/start" element={<Consent />} />
          <Route path="/setup/me" element={<Me />} />
          <Route path="/setup/help" element={<Help />} />
          <Route path="/setup/check" element={<Check />} />
          <Route path="/card" element={<Card />} />
          <Route path="/home" element={<Home />} />
          <Route path="/hospital" element={<Hospital />} />
          <Route path="/e/:patientId" element={<Emergency />} />
          <Route path="/join/:token" element={<Join />} />
          {import.meta.env.DEV && <Route path="/dev/test-email" element={<TestEmail />} />}
          <Route path="*" element={<Landing />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
    </MotionConfig>
  )
}
