/**
 * Offline copy of the patient's OWN emergency card (T16).
 *
 * Kept by the app, not by service worker rules, so that:
 * - only the card that belongs to this device is stored (a responder who scans someone else's card stores nothing),
 * - it holds only what /api/emergency returns (the public briefing subset: never transcripts or doctor data),
 * - it expires after OFFLINE_TTL_MS and is replaced every time the card is opened online,
 * - it is removed when the device is reset or the server says the card no longer exists.
 *
 * Anyone holding the unlocked phone can read this copy; it is the same data the card's QR code shows.
 */
import type { EmergencyData } from './types'

export const OFFLINE_CACHE = 'vc-offline-card-v1'
export const OFFLINE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Synthetic key for the card JSON (never requested from the network) */
const CARD_KEY = '/__voxcare/offline-card.json'
/** Old service worker caches that stored any scanned card with no expiry */
const LEGACY_CACHES = ['vc-emergency', 'vc-briefings']

interface Stored { savedAt: number; data: EmergencyData }

const hasCaches = () => typeof caches !== 'undefined'
const abs = (u: string) => new URL(u, globalThis.location?.href ?? 'http://localhost/').href
const remote = (u: string | null | undefined): u is string => !!u && /^https?:/.test(u)

/** Store this device's own card and its audio and photo. Best effort: never throws. */
export async function saveOfflineCard(data: EmergencyData, now = Date.now()): Promise<void> {
  if (!hasCaches()) return
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    const files = [...Object.values(data.audio), data.photo_url].filter(remote)
    for (const url of files) {
      if (await cache.match(url)) continue
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
        if (res.ok && res.status === 200) await cache.put(url, res)
      } catch { /* offline or blocked: keep what we have */ }
    }
    await cache.put(abs(CARD_KEY), new Response(JSON.stringify({ savedAt: now, data } satisfies Stored), { headers: { 'content-type': 'application/json' } }))
    // Drop audio from older versions of the briefing
    const keep = new Set([CARD_KEY, ...files].map(abs))
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req)
  } catch { /* storage full or unavailable */ }
}

/** The saved card for this patient, or null if there is none, it belongs to someone else or it has expired. */
export async function loadOfflineCard(patientId: string, now = Date.now()): Promise<EmergencyData | null> {
  if (!hasCaches()) return null
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    const res = await cache.match(abs(CARD_KEY))
    if (!res) return null
    const stored = (await res.json()) as Stored
    if (stored.data?.id !== patientId) return null
    if (!(now - stored.savedAt < OFFLINE_TTL_MS)) { await clearOfflineCard(); return null }
    const photo = remote(stored.data.photo_url) ? await offlineFileUrl(stored.data.photo_url) : stored.data.photo_url
    return { ...stored.data, photo_url: photo }
  } catch { return null }
}

/** A local blob URL for a saved file, or the original URL if it is not saved. */
export async function offlineFileUrl(url: string): Promise<string> {
  if (!hasCaches()) return url
  try {
    const res = await (await caches.open(OFFLINE_CACHE)).match(url)
    return res ? URL.createObjectURL(await res.blob()) : url
  } catch { return url }
}

/** Remove every offline copy of the card (device reset, card deleted). */
export async function clearOfflineCard(): Promise<void> {
  if (!hasCaches()) return
  try { await Promise.all([OFFLINE_CACHE, ...LEGACY_CACHES].map((n) => caches.delete(n))) } catch { /* ignore */ }
}

/** Remove the caches the old service worker rules created (they stored any card, with no expiry). */
export async function clearLegacyCaches(): Promise<void> {
  if (!hasCaches()) return
  try { await Promise.all(LEGACY_CACHES.map((n) => caches.delete(n))) } catch { /* ignore */ }
}
