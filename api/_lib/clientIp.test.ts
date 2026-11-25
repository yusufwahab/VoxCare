import { describe, expect, it } from 'vitest'
import { clientKey, isPrivate } from './clientIp.js'

const req = (remoteAddress: string | undefined, xff?: string | string[]) => ({
  socket: { remoteAddress },
  headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
})

describe('clientKey', () => {
  it('uses the socket address when connected directly', () => {
    expect(clientKey(req('203.0.113.9'))).toEqual({ key: '203.0.113.9', source: 'socket' })
  })

  it('ignores X-Forwarded-For from a public peer', () => {
    expect(clientKey(req('203.0.113.9', '1.1.1.1')).key).toBe('203.0.113.9')
  })

  it('behind a private proxy, uses the last X-Forwarded-For entry', () => {
    expect(clientKey(req('10.1.2.3', '6.6.6.6, 7.7.7.7, 198.51.100.4'))).toEqual({ key: '198.51.100.4', source: 'forwarded' })
  })

  it('joins repeated X-Forwarded-For headers before taking the last entry', () => {
    expect(clientKey(req('10.1.2.3', ['6.6.6.6', '198.51.100.4'])).key).toBe('198.51.100.4')
  })

  it('falls back to the peer when the last entry is not an address', () => {
    expect(clientKey(req('10.1.2.3', '198.51.100.4, garbage')).key).toBe('10.1.2.3')
  })

  it('unwraps IPv4-mapped IPv6 and IPv4 with a port', () => {
    expect(clientKey(req('::ffff:203.0.113.9')).key).toBe('203.0.113.9')
    expect(clientKey(req('::ffff:10.0.0.1', '198.51.100.4:51234')).key).toBe('198.51.100.4')
  })

  it('groups IPv6 by /64', () => {
    expect(clientKey(req('2001:db8:a:b:1:2:3:4')).key).toBe('2001:db8:a:b::/64')
    expect(clientKey(req('2001:db8:a:b::9')).key).toBe('2001:db8:a:b::/64')
    expect(clientKey(req('[2001:db8:a:c::1]')).key).toBe('2001:db8:a:c::/64')
  })

  it('returns a shared "unknown" key when there is no address at all', () => {
    expect(clientKey(req(undefined))).toEqual({ key: 'unknown', source: 'unknown' })
  })
})

describe('isPrivate', () => {
  it.each(['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '127.0.0.1', '100.64.0.1', '169.254.1.1', '::1', 'fd00::1', 'fe80::1'])('%s is private', (ip) => {
    expect(isPrivate(ip)).toBe(true)
  })
  it.each(['8.8.8.8', '172.32.0.1', '203.0.113.9', '2001:db8::1', '100.128.0.1'])('%s is public', (ip) => {
    expect(isPrivate(ip)).toBe(false)
  })
})
