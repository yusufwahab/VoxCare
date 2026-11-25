/** Web Speech API helper (English). Voices load asynchronously, so we pre-warm them. */
let voices: SpeechSynthesisVoice[] = []

export function warmVoices() {
  if (typeof speechSynthesis === 'undefined') return
  const load = () => { voices = speechSynthesis.getVoices() }
  load()
  speechSynthesis.addEventListener?.('voiceschanged', load)
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!voices.length && typeof speechSynthesis !== 'undefined') voices = speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'en-NG') ??
    voices.find((v) => v.lang.startsWith('en-') && /natural|google|online/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith('en'))
  )
}

export function speak(text: string, onEnd?: () => void) {
  if (typeof speechSynthesis === 'undefined' || !text) return onEnd?.()
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-NG'
  const v = pickVoice()
  if (v) { u.voice = v; u.lang = v.lang }
  u.rate = 0.92
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  speechSynthesis.speak(u)
}

export const stopSpeaking = () => typeof speechSynthesis !== 'undefined' && speechSynthesis.cancel()
