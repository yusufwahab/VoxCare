import { useState } from 'react'
import { PillButton } from '../../components/ui'

/** Dev only: sends a sample alert email to DEMO_HELP_EMAIL through the server. */
export default function TestEmail() {
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/test-email', { method: 'POST' })
      const type = res.headers.get('content-type') ?? ''
      const json = type.includes('json') ? await res.json() : null
      setResult(json ? (res.ok ? `Sent to ${json.to}` : `Failed: ${json.error}`) : 'No API found. Run "npx vercel dev" so /api is available.')
    } catch { setResult('Network error') }
    setBusy(false)
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-ivory p-6 text-center">
      <div className="space-y-5">
        <h1 className="h3">Test alert email</h1>
        <p className="text-muted">Sends a sample emergency email to DEMO_HELP_EMAIL.</p>
        <PillButton onClick={send} disabled={busy}>{busy ? 'Sending' : 'Send test email'}</PillButton>
        {result && <p role="status" className="font-semibold">{result}</p>}
      </div>
    </main>
  )
}
