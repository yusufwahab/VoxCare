import { describe, expect, it, vi } from 'vitest'
import { createLimiter, resetAllLimiters } from './rateLimit.js'

describe('createLimiter', () => {
  it('allows `limit` attempts per key, then refuses with a retry time', () => {
    const l = createLimiter({ limit: 2, windowMs: 60_000 })
    expect(l.take('a')).toEqual({ ok: true })
    expect(l.take('a')).toEqual({ ok: true })
    const refused = l.take('a')
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.retryAfterMs).toBeGreaterThan(59_000)
    expect(l.take('b')).toEqual({ ok: true })
  })

  it('forgets attempts older than the window', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const l = createLimiter({ limit: 1, windowMs: 1000 })
    l.take('a')
    expect(l.take('a').ok).toBe(false)
    vi.setSystemTime(Date.now() + 1001)
    expect(l.take('a').ok).toBe(true)
  })

  it('release gives back one attempt, clear forgets the key', () => {
    const l = createLimiter({ limit: 1, windowMs: 60_000 })
    l.take('a')
    l.release('a')
    expect(l.take('a').ok).toBe(true)
    l.clear('a')
    expect(l.take('a').ok).toBe(true)
    l.release('missing')
  })

  it('bounds memory by forgetting the oldest key', () => {
    const l = createLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 })
    l.take('a')
    l.take('b')
    l.take('c')
    expect(l.take('a').ok).toBe(true)
    expect(l.take('c').ok).toBe(false)
  })

  it('resetAllLimiters clears every limiter', () => {
    const l = createLimiter({ limit: 1, windowMs: 60_000 })
    l.take('a')
    resetAllLimiters()
    expect(l.take('a').ok).toBe(true)
  })
})
