import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BellRing, Check, MapPin, Pause, Phone, Play, Siren, User } from 'lucide-react'
import { AnswerButtons, Badge, FullScreen, cx } from '../components/ui'
import { getEmergency, sendAlert } from '../lib/api'
import { LANGS, type EmergencyData, type Lang } from '../lib/types'
import { ANSWERS, QUESTIONS, type Asset } from '../data/assets'
import { speak, stopSpeaking, warmVoices } from '../lib/speech'
import { whatsappLink } from '../lib/whatsapp'
import { FACT_LABEL } from '../lib/types'

const ASKABLE = QUESTIONS.filter((q) => ANSWERS[q.id])

function getLocation(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(undefined)
    const t = setTimeout(() => resolve(undefined), 5000)
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { clearTimeout(t); resolve(undefined) },
      { timeout: 5000, maximumAge: 60_000, enableHighAccuracy: true },
    )
  })
}

export default function Emergency() {
  const { patientId = '' } = useParams()
  const [data, setData] = useState<EmergencyData | null | undefined>(undefined)
  const [alert, setAlert] = useState<'sending' | 'sent' | 'failed'>('sending')
  const [loc, setLoc] = useState<{ lat: number; lng: number } | undefined>()
  const [playing, setPlaying] = useState(false)
  const [lang, setLang] = useState<Lang | null>(null)
  const [asking, setAsking] = useState<Asset | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const seq = useRef<Lang[]>([])
  const alerted = useRef(false)

  useEffect(() => {
    warmVoices()
    getEmergency(patientId).then(setData).catch(() => setData(null))
    if (alerted.current) return
    alerted.current = true
    getLocation().then(async (l) => {
      setLoc(l)
      try {
        const r = await sendAlert(patientId, l)
        setAlert(r.sent ? 'sent' : 'failed')
      } catch { setAlert('failed') }
    })
    return () => { audio.current?.pause(); stopSpeaking() }
  }, [patientId])

  const available = LANGS.filter((l) => data?.audio[l.id])

  const finish = () => { setPlaying(false); setLang(null) }

  const playLang = (l: Lang, rest: Lang[]): void => {
    const next = () => (rest.length ? playLang(rest[0], rest.slice(1)) : finish())
    const url = data?.audio[l]
    if (!url) return next()
    setLang(l)
    setPlaying(true)
    audio.current?.pause()
    const a = new Audio(url)
    audio.current = a
    a.onended = next
    a.onerror = next
    a.play().catch(finish)
  }

  const play = () => {
    if (!data) return
    if (playing) { audio.current?.pause(); stopSpeaking(); setPlaying(false); setLang(null); return }
    if (available.length === 0) {
      // No cached audio: speak the English briefing on this device
      setPlaying(true); setLang('en')
      speak(data.text, () => { setPlaying(false); setLang(null) })
      return
    }
    seq.current = available.map((l) => l.id)
    playLang(seq.current[0], seq.current.slice(1))
  }

  const jump = (l: Lang) => {
    const i = available.findIndex((x) => x.id === l)
    if (i < 0) return
    playLang(l, available.slice(i + 1).map((x) => x.id))
  }

  if (data === undefined) {
    return <div className="grid min-h-dvh place-items-center bg-ivory"><span className="glow block h-24 w-24" /></div>
  }
  if (data === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ivory p-6 text-center">
        <div><h1 className="h3">This card was not found</h1><p className="mt-2 text-muted">Check the QR code or NFC sticker, then try again.</p></div>
      </main>
    )
  }

  const phone = data.help_phone.replace(/[^\d+]/g, '')
  const waNumber = phone.startsWith('0') ? `234${phone.slice(1)}` : phone.replace('+', '')
  const mapLink = loc ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : null
  const waText = `VoxCare emergency: ${data.name ?? 'Your family member'} needs help.${mapLink ? ` Location: ${mapLink}` : ''}`

  return (
    <main className="min-h-dvh bg-ivory pb-16 text-ink">
      <AnimatePresence>
        {alert !== 'sending' && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cx('sticky top-0 z-30 flex items-center justify-center gap-2 px-4 py-3 text-center text-lg font-semibold text-white', alert === 'sent' ? 'bg-verified' : 'bg-cocoa')} role="status">
            {alert === 'sent' ? <><Check size={22} aria-hidden /> Family has been emailed.</> : <><BellRing size={22} aria-hidden /> Could not email family. Please call them now.</>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-2xl px-4 pt-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {data.photo_url ? (
            <img src={data.photo_url} alt={data.name ?? 'The patient'} width={160} height={160} className="h-40 w-40 rounded-full object-cover shadow-soft ring-4 ring-white" />
          ) : (
            <span className="grid h-40 w-40 place-items-center rounded-full bg-sand text-muted shadow-soft ring-4 ring-white" aria-label="No photo"><User size={72} aria-hidden /></span>
          )}
          {data.name && <h1 className="text-4xl font-semibold tracking-tight">{data.name}</h1>}
          <span className="inline-flex items-center gap-2 rounded-full bg-alert px-5 py-2.5 font-mono text-sm font-medium uppercase tracking-[0.1em] text-white"><Siren size={18} aria-hidden /> Emergency · Deaf · Cannot speak</span>
        </div>

        {/* Play briefing */}
        <div className="mt-8">
          <button onClick={play} className="flex min-h-28 w-full items-center justify-center gap-4 rounded-[28px] bg-verified px-6 text-3xl font-semibold text-white shadow-lift active:scale-[0.99]" aria-label={playing ? 'Stop briefing' : 'Play briefing'}>
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/20">{playing ? <Pause size={34} aria-hidden /> : <Play size={34} aria-hidden fill="currentColor" />}</span>
            {playing ? 'Stop briefing' : 'Play briefing'}
          </button>
          <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Briefing language">
            {LANGS.map((l) => {
              const ready = !!data.audio[l.id]
              return (
                <button key={l.id} onClick={() => jump(l.id)} disabled={!ready} aria-pressed={lang === l.id}
                  className={cx('min-h-12 rounded-full border px-5 font-semibold transition-colors', lang === l.id ? 'border-ember bg-ember text-ink' : 'border-line bg-white', !ready && 'opacity-45')}>
                  {l.native}
                </button>
              )
            })}
          </div>
          {available.length === 0 && <p className="mt-3 text-center text-sm text-muted">Voice briefing in 4 languages is not ready on this card yet. English is spoken from this phone.</p>}
        </div>

        {/* Facts */}
        {data.verified.length > 0 && (
          <section className="mt-10" aria-label="Doctor-verified facts">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">Verified by a doctor</h2>
            <ul className="space-y-3">
              {data.verified.map((f) => (
                <li key={f.id} className={cx('flex items-center justify-between gap-3 rounded-[20px] bg-white p-5 shadow-soft', f.type === 'allergy' && 'ring-2 ring-alert')}>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{FACT_LABEL[f.type]}</p>
                    <p className="text-3xl font-semibold leading-tight tracking-tight">{f.value}</p>
                  </div>
                  <Badge kind="verified"><Check size={12} aria-hidden /> Verified</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}
        {data.unverified.length > 0 && (
          <section className="mt-8" aria-label="Not yet confirmed">
            <h2 className="mb-3 text-lg font-semibold">Not yet confirmed</h2>
            <ul className="space-y-3">
              {data.unverified.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-[20px] bg-self-bg p-5">
                  <p className="text-2xl font-semibold leading-tight">{f.value}</p>
                  <Badge kind="self">Self-reported</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ask the patient */}
        <section className="mt-10" aria-label="Ask the patient">
          <h2 className="mb-1 text-lg font-semibold">Ask the patient</h2>
          <p className="mb-3 text-muted">Tap a picture. Show the screen to them. They answer with a tick or a cross.</p>
          {result && <p className="mb-3 rounded-[20px] bg-sand p-4 text-xl font-semibold" role="status">{result}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ASKABLE.map((q) => (
              <button key={q.id} onClick={() => { setAsking(q); speak(q.doctorText) }} className="overflow-hidden rounded-[20px] bg-white text-left shadow-soft active:scale-[0.98]">
                <img src={q.src} alt="" width={300} height={300} loading="lazy" className="aspect-square w-full object-cover" />
                <span className="block px-3 py-2.5 text-base font-semibold leading-tight">{q.doctorText}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Call */}
        <div className="mt-10 space-y-3">
          <a href={`tel:${phone}`} className="flex min-h-24 items-center justify-center gap-3 rounded-[28px] bg-verified px-6 text-3xl font-semibold text-white shadow-lift">
            <Phone size={32} aria-hidden /> Call {data.help_name ?? 'family'}
          </a>
          <a href={whatsappLink(waNumber, waText)} target="_blank" rel="noreferrer" className="flex min-h-16 items-center justify-center gap-2 rounded-full border-2 border-ink px-6 text-xl font-semibold">
            <MapPin size={22} aria-hidden /> Send location on WhatsApp
          </a>
        </div>
      </div>

      <AnimatePresence>
        {asking && (
          <FullScreen onClose={() => setAsking(null)}>
            <img src={asking.src} alt={asking.doctorText} width={900} height={900} className="max-h-[52vh] w-auto max-w-full rounded-[28px] object-contain shadow-soft" />
            <AnswerButtons onYes={() => done(asking, true)} onNo={() => done(asking, false)} />
          </FullScreen>
        )}
      </AnimatePresence>
    </main>
  )

  function done(q: Asset, yes: boolean) {
    const a = ANSWERS[q.id]
    const text = yes ? a.yes : a.no
    setResult(`${q.doctorText} ${text}`)
    speak(text)
    setAsking(null)
  }
}

