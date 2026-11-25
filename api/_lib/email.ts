import { env, HttpError } from './env.js'
import { fetchWithTimeout, TIMEOUTS } from './fetchTimeout.js'

/** The one place Brevo is called. Server only: the API key never reaches the browser. */
async function brevoSend(msg: { to: { email: string; name?: string }; subject: string; htmlContent: string; textContent: string }): Promise<void> {
  const res = await fetchWithTimeout('Brevo', 'https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env('BREVO_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || 'VoxCare', email: env('BREVO_SENDER_EMAIL') },
      to: [msg.to],
      subject: msg.subject,
      htmlContent: msg.htmlContent,
      textContent: msg.textContent,
    }),
  }, TIMEOUTS.brevo)
  if (!res.ok) throw new HttpError(502, `Brevo error ${res.status}`)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Warm Ember palette
const C = { ink: '#24140E', cocoa: '#4A2618', ember: '#E8833A', amber: '#F4B263', ivory: '#FBF6EE', sand: '#F2E5D2', line: '#E6D8C4', muted: '#7A685B' }

function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:${C.ivory};font-family:Arial,Helvetica,sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid ${C.line}">
<tr><td style="background:${C.cocoa};background-image:linear-gradient(135deg,${C.cocoa},${C.ember} 70%,${C.amber});padding:22px 28px;color:${C.ivory};font-size:20px;font-weight:bold;letter-spacing:-0.3px">voxcare</td></tr>
${inner}
<tr><td style="padding:18px 28px;background:${C.sand};color:${C.muted};font-size:12px">VoxCare helps Deaf and speech-impaired people communicate in emergencies.</td></tr>
</table></td></tr></table></body></html>`
}

const button = (href: string, label: string, bg = C.ember, fg = C.ink) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};font-weight:bold;font-size:18px;text-decoration:none;padding:16px 32px;border-radius:999px">${esc(label)}</a>`

export interface AlertEmailInput {
  to: string
  patientName: string | null
  photoUrl: string | null
  helpName: string | null
  lat?: number
  lng?: number
  emergencyUrl: string
}

/** Emails the help person when an emergency page is opened for their person. */
export async function sendAlertEmail(a: AlertEmailInput): Promise<void> {
  const who = a.patientName?.trim() || 'your family member'
  const WHO = a.patientName?.trim() || 'Your family member'
  const hasLoc = Number.isFinite(a.lat) && Number.isFinite(a.lng)
  const mapUrl = hasLoc ? `https://maps.google.com/?q=${a.lat},${a.lng}` : null
  const when = new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })

  const photo = a.photoUrl
    ? `<img src="${esc(a.photoUrl)}" width="96" height="96" alt="${esc(WHO)}" style="display:block;margin:0 auto 16px;border-radius:48px;object-fit:cover;border:4px solid ${C.sand}">`
    : ''
  const html = shell(`
<tr><td align="center" style="padding:32px 28px 8px">
${photo}
<div style="display:inline-block;background:#D64531;color:#fff;font-size:12px;font-weight:bold;letter-spacing:1.5px;padding:6px 14px;border-radius:999px">EMERGENCY</div>
<h1 style="margin:16px 0 6px;font-size:26px;line-height:1.2;letter-spacing:-0.5px">${esc(WHO)} needs help</h1>
<p style="margin:0;font-size:18px;color:${C.cocoa}">Someone is with them now.</p>
</td></tr>
<tr><td align="center" style="padding:20px 28px 4px">${mapUrl ? button(mapUrl, 'Open location') : `<p style="margin:0;color:${C.muted}">Location was not shared.</p>`}</td></tr>
<tr><td align="center" style="padding:12px 28px 8px">${button(a.emergencyUrl, 'View emergency page', C.ink, C.ivory)}</td></tr>
<tr><td align="center" style="padding:12px 28px 28px;color:${C.muted};font-size:13px">${esc(when)} (Lagos time)</td></tr>`)

  const text = [
    `VoxCare emergency: ${WHO} needs help.`,
    'Someone is with them now.',
    mapUrl ? `Open location: ${mapUrl}` : 'Location was not shared.',
    `View emergency page: ${a.emergencyUrl}`,
    `Time: ${when} (Lagos time)`,
  ].join('\n')

  await brevoSend({ to: { email: a.to, name: a.helpName ?? undefined }, subject: `VoxCare emergency: ${who} needs help`, htmlContent: html, textContent: text })
}

/** Sent once when the help person joins from the link. */
export async function sendWelcomeEmail(a: { to: string; patientName: string | null; photoUrl: string | null }): Promise<void> {
  const WHO = a.patientName?.trim() || 'Someone'
  const photo = a.photoUrl
    ? `<img src="${esc(a.photoUrl)}" width="88" height="88" alt="${esc(WHO)}" style="display:block;margin:0 auto 16px;border-radius:44px;object-fit:cover;border:4px solid ${C.sand}">`
    : ''
  const html = shell(`
<tr><td align="center" style="padding:32px 28px 28px">
${photo}
<h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;letter-spacing:-0.5px">You are now ${esc(WHO)}'s help person</h1>
<p style="margin:0;font-size:17px;line-height:1.5;color:${C.cocoa}">If ${esc(WHO)} is ever in an emergency, you will get an email from VoxCare with their location. Nothing else is needed from you.</p>
</td></tr>`)
  const text = `You are now ${WHO}'s help person on VoxCare. If they are ever in an emergency, you will get an email with their location. Nothing else is needed from you.`
  await brevoSend({ to: { email: a.to }, subject: `You are ${WHO}'s VoxCare help person`, htmlContent: html, textContent: text })
}
