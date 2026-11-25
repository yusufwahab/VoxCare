import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PictureCard } from './ui'

describe('PictureCard', () => {
  it('without an action it is a picture, not a focusable button', () => {
    const html = renderToStaticMarkup(<PictureCard src="/p.webp" label="Private" />)
    expect(html).not.toContain('<button')
    expect(html).not.toContain('aria-pressed')
    expect(html).toContain('alt="Private"')
  })

  it('with an action it stays a button that reports its pressed state', () => {
    const html = renderToStaticMarkup(<PictureCard src="/p.webp" label="Pain" selected onClick={() => {}} />)
    expect(html).toContain('<button')
    expect(html).toContain('aria-pressed="true"')
  })
})
