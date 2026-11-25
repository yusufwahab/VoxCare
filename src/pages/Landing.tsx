import { useState } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Check, Play, Stethoscope, ShieldCheck, Trash2, Lock } from 'lucide-react'
import { Eyebrow, GlassCard, PillButton } from '../components/ui'
import { MiniBody, type Pin } from '../components/BodyMap'
import { UI } from '../data/assets'
import { LANGS } from '../lib/types'
import { speak, stopSpeaking, warmVoices } from '../lib/speech'

const heroPin: Pin = { id: 'hero', view: 'front', x: 43.2, y: 70.6, regionName: 'Right knee', kind: 'sharp' }

const reveal = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 0.6, ease: 'easeOut' as const } }

export default function Landing() {
  const [lang, setLang] = useState(LANGS[0].id)
  const [playing, setPlaying] = useState(false)
  const SAMPLES: Record<string, string> = {
    en: 'This person is Deaf and cannot speak. Face them, use gestures, and show them the pictures on this screen.',
    yo: 'Eniyan yii jẹ aditi, ko si le sọrọ. Koju si i, lo awọn ami ọwọ.',
    ig: 'Onye a bụ ntị chiri, ọ nweghị ike ikwu okwu. Lee ya anya, jiri aka gosi ya.',
    ha: 'Wannan mutumin kurma ne kuma ba ya iya magana. Ku fuskance shi, ku yi amfani da hannu.',
  }
  const play = () => {
    warmVoices()
    if (playing) { stopSpeaking(); setPlaying(false); return }
    setPlaying(true)
    speak(SAMPLES.en, () => setPlaying(false))
  }

  return (
    <main className="bg-ivory">
      {/* 1. Hero */}
      <section className="relative isolate overflow-hidden text-ivory" style={{ background: 'var(--warm-gradient)' }}>
        <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <span className="flex items-center gap-2 text-xl font-semibold tracking-tight"><span className="glow inline-block h-5 w-5" aria-hidden /> voxcare</span>
          <div className="flex items-center gap-2">
            <Link to="/hospital" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-semibold hover:bg-white/10 sm:inline-flex">Hospital mode</Link>
            <PillButton to="/start" variant="ivory" className="!min-h-11 !text-sm">Get my card</PillButton>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-12">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10">
            <Eyebrow tone="light">Healthcare without barriers</Eyebrow>
            <h1 className="display mt-6 max-w-xl">Speak without a voice.</h1>
            <p className="mt-6 max-w-md text-lg text-ivory/80 sm:text-xl">Tap where it hurts. Pick a picture. VoxCare says it out loud, for doctors and for first responders.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <PillButton to="/start" variant="ivory" size="lg">Get my VoxCare card</PillButton>
              <PillButton to="/hospital" variant="ghost-light" size="lg">Hospital mode</PillButton>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }} className="relative">
            <img src={UI.talkDoctor} alt="A patient and a doctor communicating with pictures on a tablet" width={900} height={900} fetchPriority="high" className="aspect-[4/4.2] w-full rounded-[28px] object-cover shadow-[0_40px_90px_-30px_rgba(0,0,0,.55)]" />
            <GlassCard className="absolute -bottom-6 left-4 right-4 flex items-center gap-4 bg-ink/45 p-4 sm:left-auto sm:right-[-1.5rem] sm:max-w-sm">
              <MiniBody pins={[heroPin]} height="120px" />
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ivory/70">VoxCare says</p>
                <p className="mt-1 text-lg font-semibold leading-snug">I have a sharp pain in my right knee.</p>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* 2. Problem */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:py-32">
        <motion.div {...reveal}>
          <Eyebrow>The problem</Eyebrow>
          <h2 className="h2 mt-5 max-w-lg">Most clinics have no one who can sign.</h2>
          <p className="mt-5 max-w-md text-lg text-muted">Deaf patients are left to guess, point and hope. In an emergency, minutes are lost.</p>
        </motion.div>
        <motion.div {...reveal} className="overflow-hidden rounded-[28px] shadow-soft">
          <img src={UI.hospitalTablet} alt="A tablet in a hospital showing the VoxCare picture screen" width={1000} height={760} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </motion.div>
      </section>

      {/* 3. How it works */}
      <section className="bg-sand py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <motion.div {...reveal} className="mb-14 max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="h2 mt-5">Three steps. No reading needed.</h2>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { img: UI.setupPhoto, title: 'Set up in 20 seconds', text: 'A photo, one help person. That is all.' },
              { img: UI.introDoctor, title: 'Talk to any doctor', text: 'Tap the body. Pick pictures. It speaks.' },
              { img: UI.nfcTap, title: 'Your phone speaks in an emergency', text: 'Tap or scan. Family is alerted.' },
            ].map((s, i) => (
              <motion.article key={s.title} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }} className="group">
                <div className="overflow-hidden rounded-[28px] bg-ivory shadow-soft">
                  <img src={s.img} alt={s.title} width={640} height={640} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <p className="mt-5 font-mono text-xs font-medium tracking-[0.12em] text-ember">0{i + 1}</p>
                <h3 className="h3 mt-1">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Languages */}
      <section className="relative overflow-hidden bg-cocoa py-24 text-ivory lg:py-32">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-ember/25 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <motion.div {...reveal}>
            <Eyebrow tone="light">Languages</Eyebrow>
            <h2 className="h2 mt-5 max-w-lg">Briefings in English, Yorùbá, Igbo and Hausa.</h2>
            <p className="mt-5 max-w-md text-lg text-ivory/75">Responders hear the doctor-verified facts in the language they understand.</p>
          </motion.div>
          <motion.div {...reveal}>
            <GlassCard className="p-6 sm:p-8">
              <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Sample language">
                {LANGS.map((l) => (
                  <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} className={`min-h-11 rounded-full border px-5 font-semibold transition-colors ${lang === l.id ? 'border-ember bg-ember text-ink' : 'border-white/35 hover:bg-white/10'}`}>{l.native}</button>
                ))}
              </div>
              <p className="min-h-[5.5rem] text-xl font-semibold leading-snug">{SAMPLES[lang]}</p>
              <button onClick={play} className="mt-6 inline-flex min-h-14 items-center gap-3 rounded-full bg-ivory pl-6 pr-2 font-semibold text-ink">
                {playing ? 'Stop sample' : 'Play sample'}
                <span className="grid h-11 w-11 place-items-center rounded-full bg-cocoa text-ivory"><Play size={18} fill="currentColor" aria-hidden /></span>
              </button>
              <p className="mt-3 text-xs text-ivory/60">Preview voice plays in English. Full briefings use a Nigerian voice.</p>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* 5. Trust */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <motion.div {...reveal} className="mb-14 max-w-2xl">
          <Eyebrow>Trust</Eyebrow>
          <h2 className="h2 mt-5">Yours to keep. Yours to delete.</h2>
        </motion.div>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { img: UI.consentPrivate, icon: <Lock size={18} aria-hidden />, title: 'Private by default', text: 'Only a doctor or responder with your card can open it.' },
            { img: UI.consentAllow, icon: <ShieldCheck size={18} aria-hidden />, title: 'Doctor-verified facts', text: 'Only confirmed facts are read as certain.' },
            { img: UI.consentDelete, icon: <Trash2 size={18} aria-hidden />, title: 'Delete anytime', text: 'You are always in control of your card.' },
          ].map((t, i) => (
            <motion.article key={t.title} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }}>
              <img src={t.img} alt={t.title} width={640} height={640} loading="lazy" className="aspect-[5/4] w-full rounded-[28px] object-cover shadow-soft" />
              <h3 className="mt-5 flex items-center gap-2 text-xl font-semibold tracking-tight"><span className="text-ember">{t.icon}</span>{t.title}</h3>
              <p className="mt-1 text-muted">{t.text}</p>
            </motion.article>
          ))}
        </div>
        <motion.div {...reveal} className="mt-16 flex flex-wrap items-center justify-between gap-6 rounded-[28px] p-8 text-ivory sm:p-12" style={{ background: 'var(--warm-gradient)' }}>
          <h2 className="h2 max-w-md">Ready in 20 seconds.</h2>
          <div className="flex flex-wrap gap-3">
            <PillButton to="/start" variant="ivory" size="lg" icon={<Check size={22} />}>Get my card</PillButton>
            <PillButton to="/hospital" variant="ghost-light" size="lg" icon={<Stethoscope size={22} />}>Hospital mode</PillButton>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-line px-5 py-10 text-sm text-muted sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <span className="font-semibold text-ink">voxcare</span>
          <span>Built for Deaf and speech-impaired people in Nigeria.</span>
        </div>
      </footer>
    </main>
  )
}
