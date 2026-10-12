import { useSyncExternalStore } from 'react'

function subscribe(query: string, callback: () => void) {
  const list = window.matchMedia(query)
  list.addEventListener('change', callback)
  return () => list.removeEventListener('change', callback)
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const MOBILE_QUERY = '(max-width: 767px)'
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)'
export const DESKTOP_QUERY = '(min-width: 1024px)'

export function useBreakpoint() {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const isTablet = useMediaQuery(TABLET_QUERY)
  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet }
}
