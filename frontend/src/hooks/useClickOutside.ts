import { useEffect, type RefObject } from 'react'

export function useClickOutside(
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  onOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return
    const list = Array.isArray(refs) ? refs : [refs]
    const handler = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (list.every((ref) => ref.current && !ref.current.contains(target))) onOutside()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [refs, onOutside, active])
}
