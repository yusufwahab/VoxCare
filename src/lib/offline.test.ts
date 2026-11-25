import { beforeEach, describe, expect, it, vi } from 'vitest'
import { json, mockFetch } from '../../test/mocks/fetch'
import { clearLegacyCaches, clearOfflineCard, loadOfflineCard, OFFLINE_CACHE, OFFLINE_TTL_MS, saveOfflineCard } from './offline'
import { getEmergency } from './api'
import { useDevice } from '../store/device'
import type { EmergencyData } from './types'

/** Minimal in-memory Cache Storage (the browser API is not in Node) */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  const key = (r: RequestInfo | URL) => new URL(typeof r === 'string' ? r : r instanceof URL ? r.href : r.url, 'http://localhost/').href
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const m = stores.get(name)!
    return {
      match: async (r: RequestInfo | URL) => m.get(key(r))?.clone(),
      put: async (r: RequestInfo | URL, res: Response) => { m.set(key(r), res.clone()) },
      delete: async (r: RequestInfo | URL) => m.delete(key(r)),
      keys: async () => [...m.keys()].map((u) => new Request(u)),
    }
  }
  const api = { open, delete: async (name: string) => stores.delete(name), has: async (name: string) => stores.has(name) }
  vi.stubGlobal('caches', api)
  return { stores, urls: (name = OFFLINE_CACHE) => [...(stores.get(name)?.keys() ?? [])] }
}

const AUDIO_EN = 'https://x.supabase.co/storage/v1/object/public/briefings/p1/en-1.mp3'
const AUDIO_YO = 'https://x.supabase.co/storage/v1/object/public/briefings/p1/yo-1.mp3'
const PHOTO = 'https://x.supabase.co/storage/v1/object/public/photos/p1.webp'

const card = (over: Partial<EmergencyData> = {}): EmergencyData => ({
  id: 'p1', name: 'Ada', photo_url: PHOTO, help_phone: '08000000000', help_name: 'Mum',
  verified: [{ id: 'f1', type: 'allergy', value: 'Penicillin', status: 'doctor_verified' }], unverified: [],
  audio: { en: AUDIO_EN, yo: AUDIO_YO }, text: 'Ada is allergic to Penicillin.', ...over,
})

const files = () => mockFetch([['https://x.supabase.co/', () => new Response('bytes', { status: 200 })]])

describe('offline emergency card (T16)', () => {
  let c: ReturnType<typeof fakeCaches>
  beforeEach(() => { c = fakeCaches() })

  it('saves the card, its audio and photo, and loads it back for the same patient', async () => {
    const f = files()
    await saveOfflineCard(card())
    expect(f).toHaveBeenCalledTimes(3)
    expect(f.mock.calls[0][1]).toMatchObject({ mode: 'cors', credentials: 'omit' })
    expect(c.urls()).toEqual(expect.arrayContaining([AUDIO_EN, AUDIO_YO, PHOTO]))
    const loaded = await loadOfflineCard('p1')
    expect(loaded?.verified[0].value).toBe('Penicillin')
    expect(loaded?.audio.en).toBe(AUDIO_EN)
    expect(loaded?.savedAt).toEqual(expect.any(Number)) // the page says it is a saved copy
  })

  it('never returns the saved card for a different patient', async () => {
    files()
    await saveOfflineCard(card())
    expect(await loadOfflineCard('someone-else')).toBeNull()
  })

  it('expires after the time limit and removes the copy', async () => {
    files()
    const t = Date.now()
    await saveOfflineCard(card(), t)
    expect(await loadOfflineCard('p1', t + OFFLINE_TTL_MS - 1000)).not.toBeNull()
    expect(await loadOfflineCard('p1', t + OFFLINE_TTL_MS)).toBeNull()
    expect(c.stores.has(OFFLINE_CACHE)).toBe(false)
  })

  it('drops audio from an older briefing and does not download files it already has', async () => {
    const f = files()
    await saveOfflineCard(card())
    await saveOfflineCard(card({ audio: { en: AUDIO_EN } }))
    expect(f).toHaveBeenCalledTimes(3) // nothing new to download
    expect(c.urls()).not.toContain(AUDIO_YO)
    expect(c.urls()).toContain(AUDIO_EN)
  })

  it('keeps the card when a file cannot be downloaded (no signal)', async () => {
    mockFetch([['https://x.supabase.co/', () => { throw new TypeError('Failed to fetch') }]])
    await saveOfflineCard(card())
    expect((await loadOfflineCard('p1'))?.name).toBe('Ada')
  })

  it('does not store failed downloads', async () => {
    mockFetch([['https://x.supabase.co/', () => new Response('nope', { status: 404 })]])
    await saveOfflineCard(card())
    expect(c.urls()).not.toContain(AUDIO_EN)
  })

  it('stores only what the emergency endpoint returns (no transcripts or doctor data)', async () => {
    files()
    await saveOfflineCard(card())
    const raw = await (await (await caches.open(OFFLINE_CACHE)).match('/__voxcare/offline-card.json'))!.text()
    expect(raw).not.toMatch(/transcript|token|doctor_id|summary/)
  })

  it('is cleared when the patient resets the device', async () => {
    files()
    await saveOfflineCard(card())
    useDevice.getState().reset()
    await vi.waitFor(() => expect(c.stores.has(OFFLINE_CACHE)).toBe(false))
    expect(await loadOfflineCard('p1')).toBeNull()
  })

  it('is cleared when a different card is set up on this phone', async () => {
    files()
    useDevice.setState({ patientId: 'p1' })
    await saveOfflineCard(card())
    useDevice.getState().setPatient('p2', 't2')
    await vi.waitFor(() => expect(c.stores.has(OFFLINE_CACHE)).toBe(false))
  })

  it('clearOfflineCard and clearLegacyCaches remove the old service worker caches', async () => {
    await (await caches.open('vc-emergency')).put('https://api.example/api/emergency?id=p9', json({}))
    await (await caches.open('vc-briefings')).put(AUDIO_EN, new Response('x'))
    await clearLegacyCaches()
    expect(c.stores.has('vc-emergency')).toBe(false)
    expect(c.stores.has('vc-briefings')).toBe(false)
    files()
    await saveOfflineCard(card())
    await clearOfflineCard()
    expect(c.stores.size).toBe(0)
  })

  it('does nothing when the browser has no Cache Storage', async () => {
    vi.stubGlobal('caches', undefined)
    await expect(saveOfflineCard(card())).resolves.toBeUndefined()
    expect(await loadOfflineCard('p1')).toBeNull()
  })
})

describe('getEmergency (browser client)', () => {
  it('returns null when the server says the card does not exist, so the offline copy is removed', async () => {
    mockFetch([['/api/emergency', () => json({ error: 'Not found' }, 404)]])
    expect(await getEmergency('p1')).toBeNull()
  })

  it('throws when the server cannot be reached, so the offline copy is used', async () => {
    mockFetch([['/api/emergency', () => { throw new TypeError('Failed to fetch') }]])
    await expect(getEmergency('p1')).rejects.toThrow(TypeError)
  })

  it('throws on a server error instead of reporting the card as missing', async () => {
    mockFetch([['/api/emergency', () => json({ error: 'Something went wrong. Please try again.' }, 500)]])
    await expect(getEmergency('p1')).rejects.toThrow('Something went wrong')
  })
})
