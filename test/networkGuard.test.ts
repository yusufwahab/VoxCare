/// <reference types="vite/client" />
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { NETWORK_BLOCKED } from './networkGuard.js'
import { testDb } from './mocks/supabase.js'
import { TEST_ENV } from './env.js'

/** Resolve with the error a request or socket emits */
const errorOf = (emitter: { on: (e: 'error', cb: (err: NodeJS.ErrnoException) => void) => unknown }) =>
  new Promise<NodeJS.ErrnoException>((resolve) => emitter.on('error', resolve))

describe('network guard', () => {
  it('blocks fetch to an outside host', async () => {
    await expect(fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST' })).rejects.toMatchObject({ code: NETWORK_BLOCKED })
    await expect(fetch('https://api.yarngpt.ai/api/v1/tts')).rejects.toMatchObject({ code: NETWORK_BLOCKED })
  })

  it('blocks node:http and node:https clients', async () => {
    const a = http.get('http://example.com/')
    expect((await errorOf(a)).code).toBe(NETWORK_BLOCKED)
    const b = https.request('https://example.com/', { method: 'POST' })
    b.end()
    expect((await errorOf(b)).code).toBe(NETWORK_BLOCKED)
  })

  it('blocks raw TCP sockets', async () => {
    const s = net.connect(443, '93.184.216.34')
    expect((await errorOf(s)).code).toBe(NETWORK_BLOCKED)
  })

  it('still allows loopback, for tests that start a local server', async () => {
    const server = http.createServer((_req, res) => res.end('ok'))
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    try {
      const { port } = server.address() as AddressInfo
      expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe('ok')
    } finally {
      server.close()
    }
  })

  it('a test-level fetch mock still works and is removed afterwards', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('mocked')))
    expect(await (await fetch('https://anything.example')).text()).toBe('mocked')
  })

  it('the guard is back after the previous test unstubbed fetch', async () => {
    await expect(fetch('https://anything.example')).rejects.toMatchObject({ code: NETWORK_BLOCKED })
  })
})

describe('isolation', () => {
  it('createClient returns the in-memory fake, even with a real-looking URL', async () => {
    const client = createClient('https://real-project.supabase.co', 'real-looking-key')
    await client.from('patients').insert({ name: 'Test' })
    expect(testDb.rows('patients')).toHaveLength(1)
  })

  it('the fake database is empty again in the next test', () => {
    expect(testDb.rows('patients')).toHaveLength(0)
  })

  it('every service key is a dummy value', () => {
    for (const [key, value] of Object.entries(TEST_ENV)) expect(process.env[key]).toBe(value)
    expect(import.meta.env.VITE_API_URL).toBe('')
  })

  it('environment edits are undone after each test (part 1)', () => {
    process.env.BREVO_API_KEY = 'changed-directly'
    vi.stubEnv('YARNGPT_API_KEY', 'changed-with-stubEnv')
    process.env.SOMETHING_NEW = 'x'
  })

  it('environment edits are undone after each test (part 2)', () => {
    expect(process.env.BREVO_API_KEY).toBe(TEST_ENV.BREVO_API_KEY)
    expect(process.env.YARNGPT_API_KEY).toBe(TEST_ENV.YARNGPT_API_KEY)
    expect(process.env.SOMETHING_NEW).toBeUndefined()
  })

  it('fake timers are switched off after each test (part 1)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2000-01-01'))
  })

  it('fake timers are switched off after each test (part 2)', () => {
    expect(vi.isFakeTimers()).toBe(false)
    expect(new Date().getFullYear()).toBeGreaterThan(2000)
  })
})
