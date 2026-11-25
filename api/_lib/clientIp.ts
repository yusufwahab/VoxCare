import { isIP } from 'node:net'
import type { IncomingMessage } from 'node:http'

/**
 * Who is calling, for rate limiting. Never trusts what a client can write itself.
 *
 *  - X-Forwarded-For is only read when the TCP peer is a private or loopback address, meaning we sit behind
 *    a proxy (Render's load balancer). A client connecting straight from the internet cannot use it.
 *  - Even then only the LAST entry is used: that is the one our proxy appended. Earlier entries are whatever
 *    the client sent, so spoofing "X-Forwarded-For: 1.2.3.4" changes nothing.
 *  - IPv6 addresses are grouped by /64, because one connection usually controls a whole /64.
 *
 * Assumes exactly one proxy in front of the server. If another proxy (for example a CDN) is added in front of
 * Render, the last entry becomes that proxy's address and everyone behind it shares one limit.
 */
export interface ClientKey {
  key: string
  /** Where the key came from. Logged (without the address) so the deployment can be checked. */
  source: 'forwarded' | 'socket' | 'unknown'
}

function clean(raw: string): string | null {
  let s = raw.trim().split('%')[0]
  if (s.startsWith('[')) s = s.slice(1, s.indexOf(']') > 0 ? s.indexOf(']') : undefined)
  const v4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(s)
  if (v4WithPort) s = v4WithPort[1]
  if (/^::ffff:/i.test(s) && isIP(s.slice(7)) === 4) s = s.slice(7)
  return isIP(s) ? s.toLowerCase() : null
}

/** The 8 groups of an IPv6 address as numbers */
function groups(ip: string): number[] {
  let s = ip
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s)
  if (v4) {
    const [a, b, c, d] = v4[1].split('.').map(Number)
    s = `${s.slice(0, -v4[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, tail] = s.split('::')
  const h = head ? head.split(':') : []
  const t = tail === undefined ? [] : tail ? tail.split(':') : []
  const fill = tail === undefined ? [] : Array<string>(8 - h.length - t.length).fill('0')
  return [...h, ...fill, ...t].map((x) => parseInt(x || '0', 16))
}

export function isPrivate(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)
  }
  const g = groups(ip)
  const loopback = g.slice(0, 7).every((x) => x === 0) && g[7] === 1
  return loopback || (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80
}

function keyFor(ip: string): string {
  if (isIP(ip) === 4) return ip
  return `${groups(ip).slice(0, 4).map((x) => x.toString(16)).join(':')}::/64`
}

export function clientKey(req: Pick<IncomingMessage, 'headers'> & { socket?: { remoteAddress?: string } }): ClientKey {
  const peer = clean(req.socket?.remoteAddress ?? '')
  const header = req.headers['x-forwarded-for']
  const forwarded = Array.isArray(header) ? header.join(',') : header
  if (peer && isPrivate(peer) && forwarded) {
    const entries = forwarded.split(',')
    const last = clean(entries[entries.length - 1] ?? '')
    if (last) return { key: keyFor(last), source: 'forwarded' }
  }
  if (peer) return { key: keyFor(peer), source: 'socket' }
  return { key: 'unknown', source: 'unknown' }
}
