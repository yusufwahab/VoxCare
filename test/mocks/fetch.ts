/**
 * Mock external services (Brevo, YarnGPT, the VoxCare API from the browser) by URL.
 * A request that matches no route throws, so nothing unplanned can leave the test.
 * The stub is removed after each test (unstubGlobals in vite.config.ts).
 *
 *   const f = mockFetch([['https://api.brevo.com/', () => json({}, 201)]])
 *   expect(f).toHaveBeenCalledTimes(1)
 */
import { vi } from 'vitest'

export type FetchRoute = [match: string | RegExp, respond: (url: string, init?: RequestInit) => Response | Promise<Response>]

export function mockFetch(routes: FetchRoute[]) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const route = routes.find(([m]) => (typeof m === 'string' ? url.startsWith(m) : m.test(url)))
    if (!route) throw new Error(`No fetch mock matches ${url}. Real network access is blocked in tests.`)
    return route[1](url, init)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
