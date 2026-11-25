import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, User } from 'lucide-react'
import { Eyebrow, Page, PillButton } from '../components/ui'
import { getJoinInfo, joinAsHelper, type JoinInfo } from '../lib/api'

/** Opens on the help person's phone from the WhatsApp link. */
export default function Join() {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<JoinInfo | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getJoinInfo(token).then(setInfo) }, [token])

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const who = info?.name?.trim() || 'Someone'

  const submit = async () => {
    setBusy(true); setError('')
    try { await joinAsHelper(token, email.trim()); setDone(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not join. Try again.') }
    finally { setBusy(false) }
  }

  if (info === undefined) return <div className="grid min-h-dvh place-items-center bg-ivory"><span className="glow block h-24 w-24" /></div>
  if (info === null) {
    return <main className="grid min-h-dvh place-items-center bg-ivory p-6 text-center"><div><h1 className="h3">This link is not valid</h1><p className="mt-2 text-muted">Ask your friend to send it again.</p></div></main>
  }

  return (
    <Page className="grid min-h-dvh place-items-center px-5 py-10" >
      <div className="w-full max-w-sm text-center">
        <div className="mb-8"><Eyebrow>VoxCare</Eyebrow></div>
        {info.photo_url
          ? <img src={info.photo_url} alt={who} width={144} height={144} className="mx-auto h-36 w-36 rounded-full object-cover shadow-soft ring-4 ring-white" />
          : <span className="mx-auto grid h-36 w-36 place-items-center rounded-full bg-sand text-muted shadow-soft ring-4 ring-white" aria-label="No photo"><User size={64} aria-hidden /></span>}

        {done ? (
          <>
            <span className="mx-auto mt-8 grid h-20 w-20 place-items-center rounded-full bg-verified text-white"><Check size={44} strokeWidth={3.2} aria-hidden /></span>
            <h1 className="h3 mt-5">You are their help person</h1>
            <p className="mt-2 text-muted">If {who} is ever in an emergency, you will get an email. We sent you a welcome email too.</p>
          </>
        ) : (
          <>
            <h1 className="h3 mt-8">{who} chose you as their help person</h1>
            <p className="mt-2 text-muted">If they are in an emergency, we email you their location.</p>
            <label className="mt-8 block text-left text-sm font-semibold text-muted">
              Your email
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} onKeyDown={(e) => e.key === 'Enter' && valid && submit()}
                className="mt-1 w-full rounded-full border border-line bg-white px-5 py-4 text-lg text-ink outline-none focus:border-ember" placeholder="name@example.com" />
            </label>
            {error && <p role="alert" className="mt-3 font-semibold text-alert">{error}</p>}
            <div className="mt-5 flex justify-center"><PillButton size="lg" disabled={!valid || busy} onClick={submit} className="w-full" icon={<Check size={22} />}>{busy ? 'Joining' : 'Join'}</PillButton></div>
          </>
        )}
      </div>
    </Page>
  )
}
