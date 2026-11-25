import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearOfflineCard } from '../lib/offline'

/** This device's own data. Persisted so the patient never has to set up twice. */
interface DeviceState {
  consented: boolean
  patientId: string | null
  token: string | null
  name: string
  photo: string | null
  helpPhone: string
  helpName: string
  helpChecked: boolean
  helpJoinToken: string | null
  helpConfirmed: boolean
  setJoin: (joinToken: string | null) => void
  setHelpConfirmed: (v: boolean) => void
  setConsent: (v: boolean) => void
  setMe: (p: { photo?: string | null; name?: string }) => void
  setHelp: (p: { helpPhone?: string; helpName?: string }) => void
  setHelpChecked: (v: boolean) => void
  setPatient: (id: string, token: string) => void
  reset: () => void
}

const initial = { consented: false, patientId: null, token: null, name: '', photo: null, helpPhone: '', helpName: '', helpChecked: false, helpJoinToken: null, helpConfirmed: false }

export const useDevice = create<DeviceState>()(
  persist(
    (set) => ({
      ...initial,
      setJoin: (helpJoinToken) => set({ helpJoinToken }),
      setHelpConfirmed: (helpConfirmed) => set({ helpConfirmed }),
      setConsent: (consented) => set({ consented }),
      setMe: (p) => set((s) => ({ photo: p.photo !== undefined ? p.photo : s.photo, name: p.name ?? s.name })),
      setHelp: (p) => set((s) => ({ helpPhone: p.helpPhone ?? s.helpPhone, helpName: p.helpName ?? s.helpName })),
      setHelpChecked: (helpChecked) => set({ helpChecked }),
      setPatient: (patientId, token) => set((s) => {
        // A new card on this phone: the offline copy of the old one must go
        if (s.patientId && s.patientId !== patientId) void clearOfflineCard()
        return { patientId, token }
      }),
      // Also removes the offline copy of the card (T16)
      reset: () => { void clearOfflineCard(); set(initial) },
    }),
    { name: 'voxcare-device' },
  ),
)

/** Staff session for Hospital mode (not persisted) */
import type { Doctor } from '../lib/types'
interface StaffState { doctor: Doctor | null; setDoctor: (d: Doctor | null) => void }
export const useStaff = create<StaffState>((set) => ({ doctor: null, setDoctor: (doctor) => set({ doctor }) }))
