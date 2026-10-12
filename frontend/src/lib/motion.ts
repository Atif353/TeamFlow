import type { Transition, Variants } from 'framer-motion'

export const durations = { fast: 0.15, base: 0.2, slow: 0.3 } as const

export const springTransition: Transition = { type: 'spring', stiffness: 300, damping: 30 }
export const baseTransition: Transition = { duration: durations.base, ease: 'easeOut' }

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: baseTransition },
}

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.fast } },
  exit: { opacity: 0, transition: { duration: durations.fast } },
}

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: springTransition },
  exit: { opacity: 0, scale: 0.96, transition: { duration: durations.fast } },
}

export const drawerVariants: Variants = {
  initial: (isMobile: boolean) => (isMobile ? { y: '100%' } : { x: '100%' }),
  animate: { x: 0, y: 0, transition: springTransition },
  exit: (isMobile: boolean) =>
    isMobile
      ? { y: '100%', transition: { duration: durations.base } }
      : { x: '100%', transition: { duration: durations.base } },
}

export const popoverVariants: Variants = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: durations.fast } },
  exit: { opacity: 0, y: -4, transition: { duration: durations.fast } },
}

export const MAX_STAGGERED_ITEMS = 8
export const STAGGER_SECONDS = 0.04

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      ...baseTransition,
      delay: Math.min(index, MAX_STAGGERED_ITEMS) * STAGGER_SECONDS,
    },
  }),
}

export const sidebarTransition: Transition = { duration: 0.22, ease: 'easeInOut' }
export const tapScale = { scale: 0.98 }
