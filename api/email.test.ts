import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendAlertEmail, sendWelcomeEmail } from './_lib/email.js'

function stubBrevo() {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
  process.env.BREVO_API_KEY = 'key-123'
  process.env.BREVO_SENDER_EMAIL = 'alerts@example.com'
  process.env.BREVO_SENDER_NAME = ''
  return fetchMock
}
afterEach(() => vi.unstubAllGlobals())

describe('Brevo emails', () => {
  it('calls the Brevo API with the right headers and body', async () => {
    const f = stubBrevo()
    await sendAlertEmail({ to: 'mum@example.com', patientName: 'Chinedu', photoUrl: 'https://x.test/p.jpg', helpName: 'Mum', lat: 6.5, lng: 3.4, emergencyUrl: 'https://app.test/e/abc' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.headers).toMatchObject({ 'api-key': 'key-123', 'content-type': 'application/json', accept: 'application/json' })
    const body = JSON.parse(init.body as string)
    expect(body.sender).toEqual({ name: 'VoxCare', email: 'alerts@example.com' })
    expect(body.to).toEqual([{ email: 'mum@example.com', name: 'Mum' }])
    expect(body.subject).toBe('VoxCare emergency: Chinedu needs help')
    expect(body.htmlContent).toContain('https://maps.google.com/?q=6.5,3.4')
    expect(body.htmlContent).toContain('Open location')
    expect(body.htmlContent).toContain('View emergency page')
    expect(body.htmlContent).toContain('https://x.test/p.jpg')
    expect(body.textContent).toContain('https://app.test/e/abc')
  })

  it('uses a generic subject and omits the map without a location', async () => {
    const f = stubBrevo()
    await sendAlertEmail({ to: 'a@b.co', patientName: null, photoUrl: null, helpName: null, emergencyUrl: 'https://app.test/e/abc' })
    const body = JSON.parse(((f.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string)
    expect(body.subject).toBe('VoxCare emergency: your family member needs help')
    expect(body.htmlContent).not.toContain('maps.google.com')
    expect(body.textContent).toContain('Location was not shared')
  })

  it('escapes names so they cannot inject HTML', async () => {
    const f = stubBrevo()
    await sendWelcomeEmail({ to: 'a@b.co', patientName: '<script>x</script>', photoUrl: null })
    const body = JSON.parse(((f.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string)
    expect(body.htmlContent).not.toContain('<script>')
  })

  it('throws when Brevo rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 401 })))
    process.env.BREVO_API_KEY = 'k'
    process.env.BREVO_SENDER_EMAIL = 'a@b.co'
    await expect(sendWelcomeEmail({ to: 'x@y.co', patientName: null, photoUrl: null })).rejects.toThrow(/Brevo error 401/)
  })
})
