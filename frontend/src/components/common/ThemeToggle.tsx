import { Moon, Sun } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { resolveTheme, useThemeStore } from '@/store/themeStore'

export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode)
  const toggle = useThemeStore((state) => state.toggle)
  const isDark = resolveTheme(mode) === 'dark'
  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    />
  )
}
