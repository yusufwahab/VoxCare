/**
 * Blocks real network access during tests. Two layers:
 *  1. globalThis.fetch is replaced, so fetch() to any non-local host rejects.
 *  2. net.Socket.prototype.connect is patched, which catches everything else that opens a TCP or TLS
 *     connection (node:http, node:https, node:net, node:tls, undici, HTTP client libraries).
 * Loopback hosts (localhost, 127.x, ::1) and local IPC paths stay allowed, for tests that start a local server.
 * Not covered: DNS lookups, UDP, child processes and worker threads.
 */
import { Socket } from 'node:net'

export const NETWORK_BLOCKED = 'ERR_TEST_NETWORK_BLOCKED'

export class NetworkBlockedError extends Error {
  code = NETWORK_BLOCKED
  constructor(target: string) {
    super(`Network access is blocked in tests (${target}). Mock this call instead.`)
    this.name = 'NetworkBlockedError'
  }
}

const LOCAL = /^(localhost|127(?:\.\d{1,3}){3}|::1|::ffff:127(?:\.\d{1,3}){3})$/i
const isLocal = (host: string) => LOCAL.test(host.replace(/^\[|\]$/g, ''))

/** Socket.connect is called as (options, cb), (port, host, cb), (path, cb) or, from net.connect, ([options, cb]). */
function targetOf(args: unknown[]): { host: string; port: string; path?: string } {
  let first = args[0]
  if (Array.isArray(first)) first = first[0]
  if (first && typeof first === 'object') {
    const o = first as { host?: string; port?: number | string; path?: string }
    return { host: o.host ?? 'localhost', port: String(o.port ?? ''), path: o.path }
  }
  if (typeof first === 'string' && !/^\d+$/.test(first)) return { host: '', port: '', path: first }
  return { host: typeof args[1] === 'string' ? args[1] : 'localhost', port: String(first ?? '') }
}

const MARK = Symbol.for('voxcare.test.networkGuard')
type Marked = { [MARK]?: true }

/** The real fetch of this test file's context, kept for loopback requests. */
const realFetch = globalThis.fetch

const guardedFetch: typeof fetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new TypeError(`Invalid URL: ${raw}`)
    }
    if (isLocal(url.hostname)) return realFetch(input, init)
    throw new NetworkBlockedError(url.origin)
  },
  { [MARK]: true as const },
)

/** Safe to call many times. Re-applies the fetch guard if a test replaced globalThis.fetch directly. */
export function installNetworkGuard(): void {
  const proto = Socket.prototype as unknown as Marked & { connect: (...args: unknown[]) => unknown }
  if (!proto[MARK]) {
    const original = proto.connect
    proto.connect = function (this: Socket, ...args: unknown[]) {
      const t = targetOf(args)
      if (t.path || isLocal(t.host)) return original.apply(this, args)
      const err = new NetworkBlockedError(`${t.host}:${t.port}`)
      process.nextTick(() => this.destroy(err))
      return this
    }
    proto[MARK] = true
  }
  if (!(globalThis.fetch as Marked)[MARK]) globalThis.fetch = guardedFetch
}
