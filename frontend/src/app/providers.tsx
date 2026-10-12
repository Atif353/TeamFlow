import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { useThemeStore, resolveTheme } from '@/store/themeStore'
import { queryClient } from './queryClient'

export function Providers({ children }: { children: ReactNode }) {
  const mode = useThemeStore((state) => state.mode)
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster richColors closeButton position="top-right" theme={resolveTheme(mode)} />
      </MotionConfig>
    </QueryClientProvider>
  )
}
