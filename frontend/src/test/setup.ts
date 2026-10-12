import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { useLayoutStore } from '@/store/layoutStore'
import { useThemeStore } from '@/store/themeStore'
import { installMatchMedia, resetMedia } from './matchMedia'
import { server } from './msw/server'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

installMatchMedia()
configure({ asyncUtilTimeout: 5000 })
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= () => {}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

beforeEach(() => {
  resetMedia()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  useAuthStore.setState({
    status: 'loading',
    accessToken: null,
    user: null,
    workspace: null,
    role: null,
  })
  useLayoutStore.setState({ sidebarCollapsed: false, mobileNavOpen: false })
  useThemeStore.setState({ mode: 'system' })
})

afterAll(() => server.close())
