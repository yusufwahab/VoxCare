import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { Badge, Eyebrow, PillButton, cx } from '../ui'
import { getFactsForDoctor, saveErrorMessage, saveVerifiedFacts, saveWalkInVisit } from '../../lib/api'
import { FACT_LABEL, type Fact, type FactType } from '../../lib/types'
import { useStaff } from '../../store/device'
import { useVisit } from '../../store/visit'

interface Row { id: string; type: FactType; value: string; status: Fact['status']; confirmed: boolean; isNew?: boolean; removed?: boolean }

const ADD_TYPES: FactType[] = ['condition', 'allergy', 'medicine', 'blood_group']
const BLOOD = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

export function EndVisit({ onClose, onFinished }: { onClose: () => void; onFinished: () => void }) {
  const v = useVisit()
  const doctor = useStaff((s) => s.doctor)!
  const [rows, setRows] = useState<Row[]>([])
  const [step, setStep] = useState<'summary' | 'verify' | 'saved'>('summary')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  // One id per visit: a retry after a failed save updates the same records instead of adding new ones
  const [visitId] = useState(() => crypto.randomUUID())
  const [newType, setNewType] = useState<FactType>('condition')
  const [newValue, setNewValue] = useState('')

  useEffect(() => {
    if (!v.patientId) return
    getFactsForDoctor(v.patientId, doctor.id).then((facts) =>
      setRows(facts.map((f) => ({ id: f.id, type: f.type, value: f.value, status: f.status, confirmed: f.status === 'doctor_verified' }))),
    )
  }, [v.patientId, doctor.id])

  const summary = useMemo(() => v.transcript.map((t) => `${t.who === 'doctor' ? 'Doctor' : 'Patient'}: ${t.text}`).join('\n'), [v.transcript])

  const update = (id: string, p: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const addRow = (type: FactType, value: string) => {
    const val = value.trim()
    if (!val) return
    setRows((r) => [...r, { id: crypto.randomUUID(), type, value: val, status: 'doctor_verified', confirmed: true, isNew: true }])
    setNewValue('')
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setSaveError('')
    const keep = rows.filter((r) => !r.removed && r.confirmed)
    try {
      if (v.patientId) {
        await saveVerifiedFacts({
          patientId: v.patientId, doctorId: doctor.id, visitId,
          facts: keep.map((r) => ({ id: r.isNew ? undefined : r.id, type: r.type, value: r.value })),
          remove: rows.filter((r) => r.removed && !r.isNew).map((r) => r.id),
          transcript: v.transcript, summary,
        })
      } else {
        await saveWalkInVisit(doctor.id, visitId, v.transcript, summary)
      }
      // Only after the server confirmed every write
      setStep('saved')
    } catch (e) {
      // Keep everything on screen so the doctor can fix it or try again
      setSaveError(saveErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const errorBox = saveError && <p role="alert" className="mt-6 rounded-[20px] bg-white p-4 font-semibold text-alert shadow-soft">Not saved. {saveError}</p>

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ivory" role="dialog" aria-modal="true" aria-label="End visit">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Eyebrow>{step === 'summary' ? 'Visit summary' : step === 'verify' ? 'Verify facts' : 'Saved'}</Eyebrow>
          {step !== 'saved' && <button onClick={onClose} aria-label="Back to visit" className="grid h-12 w-12 place-items-center rounded-full bg-sand"><X aria-hidden /></button>}
        </div>

        {step === 'summary' && (
          <>
            <h2 className="h2 mb-6">Everything said and answered</h2>
            {v.transcript.length === 0 ? <p className="text-muted">Nothing was recorded in this visit.</p> : (
              <ol className="space-y-3">
                {v.transcript.map((t, i) => (
                  <li key={i} className={cx('rounded-[20px] p-4', t.who === 'patient' ? 'bg-white shadow-soft' : 'bg-sand')}>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{t.who === 'patient' ? 'Patient' : 'Doctor'}</span>
                    <p className="mt-0.5 text-lg font-semibold leading-snug">{t.text}</p>
                  </li>
                ))}
              </ol>
            )}
            {!v.patientId && errorBox}
            <div className="mt-8 flex justify-end">
              <PillButton onClick={() => (v.patientId ? setStep('verify') : save())} variant="dark" disabled={saving}>{v.patientId ? 'Verify facts' : saving ? 'Saving' : saveError ? 'Try again' : 'Finish'}</PillButton>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <h2 className="h2 mb-2">Confirm what is true</h2>
            <p className="mb-6 text-muted">Only confirmed facts are saved as doctor-verified. They are read out in emergencies.</p>
            <ul className="space-y-3">
              {rows.filter((r) => !r.removed).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-[20px] border border-line bg-white p-4">
                  <span className="w-28 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{FACT_LABEL[r.type]}</span>
                  <input value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} aria-label={`${FACT_LABEL[r.type]} value`} className="min-h-11 min-w-0 flex-1 rounded-full border border-line px-4 text-lg font-semibold outline-none focus:border-ember" />
                  {r.confirmed ? <Badge kind="verified"><Check size={12} aria-hidden /> Verified</Badge> : <Badge kind="self">Self-reported</Badge>}
                  {!r.confirmed && <button onClick={() => update(r.id, { confirmed: true })} className="min-h-11 rounded-full bg-verified px-5 font-semibold text-white">Confirm</button>}
                  <button onClick={() => update(r.id, { removed: true })} aria-label={`Remove ${r.value}`} className="grid h-11 w-11 place-items-center rounded-full bg-sand"><Trash2 size={18} aria-hidden /></button>
                </li>
              ))}
              {rows.filter((r) => !r.removed).length === 0 && <li className="text-muted">No facts yet. Add the first one below.</li>}
            </ul>

            <div className="mt-6 rounded-[20px] bg-sand p-5">
              <h3 className="mb-3 font-semibold">Add a fact</h3>
              <div className="mb-3 flex flex-wrap gap-2">
                {ADD_TYPES.map((t) => <button key={t} onClick={() => setNewType(t)} aria-pressed={newType === t} className={cx('min-h-11 rounded-full px-4 font-semibold', newType === t ? 'bg-ink text-ivory' : 'bg-white')}>{FACT_LABEL[t]}</button>)}
              </div>
              {newType === 'blood_group' ? (
                <div className="flex flex-wrap gap-2">{BLOOD.map((b) => <button key={b} onClick={() => addRow('blood_group', b)} className="min-h-11 min-w-14 rounded-full bg-white px-4 font-semibold hover:bg-amber">{b}</button>)}</div>
              ) : (
                <div className="flex gap-2">
                  <input value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRow(newType, newValue)} placeholder={newType === 'allergy' ? 'e.g. Penicillin' : newType === 'medicine' ? 'e.g. Salbutamol inhaler' : 'e.g. Asthma'} className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-5 outline-none focus:border-ember" />
                  <button onClick={() => addRow(newType, newValue)} aria-label="Add fact" className="grid h-12 w-12 place-items-center rounded-full bg-ember text-ink"><Plus aria-hidden /></button>
                </div>
              )}
            </div>
            {errorBox}
            <div className="mt-8 flex justify-end"><PillButton onClick={save} disabled={saving} variant="dark">{saving ? 'Saving' : saveError ? 'Try again' : 'Save verified facts'}</PillButton></div>
          </>
        )}

        {step === 'saved' && (
          <div className="py-16 text-center">
            <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-verified text-white"><Check size={48} strokeWidth={3} aria-hidden /></span>
            <h2 className="h2 mt-6">Visit saved</h2>
            <p className="mx-auto mt-3 max-w-md text-muted">{v.patientId ? 'The voice briefing is being updated in the background, so it is ready before any emergency.' : 'Walk-in visit recorded.'}</p>
            <div className="mt-8 flex justify-center"><PillButton onClick={onFinished} variant="dark">Back to start</PillButton></div>
          </div>
        )}
      </div>
    </div>
  )
}
