import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches === true
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return prefersDark() ? 'dark' : 'light'
  return mode
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', resolveTheme(mode) === 'dark')
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => {
        applyTheme(mode)
        set({ mode })
      },
      toggle: () => get().setMode(resolveTheme(get().mode) === 'dark' ? 'light' : 'dark'),
    }),
    {
      name: 'teamflow-theme',
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.mode)
      },
    },
  ),
)

export function watchSystemTheme(): () => void {
  const query = window.matchMedia?.(DARK_QUERY)
  if (!query) return () => undefined
  const onChange = () => {
    if (useThemeStore.getState().mode === 'system') applyTheme('system')
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
