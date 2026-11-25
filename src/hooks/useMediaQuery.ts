import { useSyncExternalStore } from 'react'

/** True while the media query matches, and updates when it changes (rotation, resize) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', notify)
      return () => m.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** The shared-tablet split view needs width and landscape; anything else uses the hand-over layout */
export const WIDE_LANDSCAPE = '(min-width: 1024px) and (orientation: landscape)'
