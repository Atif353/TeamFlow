import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const openDialogs: symbol[] = []

export function useDialogBehavior(onClose: () => void, closeOnEscape = true) {
  const containerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const id = Symbol('dialog')
    openDialogs.push(id)
    const focusable = () => Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    const initial = container?.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0]
    ;(initial ?? container)?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return
      if (event.key === 'Escape' && closeOnEscape) {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        event.preventDefault()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openDialogs.splice(openDialogs.indexOf(id), 1)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [closeOnEscape])

  return containerRef
}
