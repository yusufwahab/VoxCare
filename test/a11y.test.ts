/**
 * Static accessibility checks over the source (no browser here; T27 still needs Lighthouse and axe).
 * Spec §10: alt text on every image, width and height set, ARIA labels on icon buttons, zoom allowed.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.tsx') && !e.name.includes('.test.') ? [join(dir, e.name)] : []))
const sources = files('src').map((f) => ({ f, s: readFileSync(f, 'utf8') }))
const line = (s: string, i: number) => s.slice(0, i).split('\n').length

describe('accessibility in the source', () => {
  it('every <img> has alt, width and height', () => {
    const bad: string[] = []
    for (const { f, s } of sources) {
      for (const m of s.matchAll(/<img\b[^>]*?\/?>/gs)) {
        const missing = ['alt=', 'width=', 'height='].filter((a) => !m[0].includes(a))
        if (missing.length) bad.push(`${f}:${line(s, m.index!)} missing ${missing.join(', ')}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('buttons and links without visible text have an aria-label', () => {
    const bad: string[] = []
    for (const { f, s } of sources) {
      for (const m of s.matchAll(/<(button|Link|a)\b([^>]*?)>(.*?)<\/\1>/gs)) {
        const [, , attrs, inner] = m
        const text = inner.replace(/<[^>]*>/g, '').trim()
        if (!text && !attrs.includes('aria-label') && !inner.includes('alt=')) bad.push(`${f}:${line(s, m.index!)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the page allows zoom and declares its language', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toMatch(/<html lang="en">/)
    expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/)
  })
})
