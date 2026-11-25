import { HttpError } from './env.js'

/** How long one call to an outside service may take */
export const TIMEOUTS = { brevo: 10_000, yarnApi: 15_000, yarnAudio: 30_000 } as const

/**
 * fetch() that gives up after `ms`. A timeout becomes a 504 and a network failure a 502, with a message
 * that names only the service: URLs (job ids, signed audio links) and response bodies are never included.
 */
export async function fetchWithTimeout(service: string, url: string, init: RequestInit, ms: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new HttpError(504, `${service} timed out`)
    throw new HttpError(502, `${service} unreachable`)
  }
}
