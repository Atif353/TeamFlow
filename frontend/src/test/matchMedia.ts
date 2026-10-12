type Listener = (event: MediaQueryListEvent) => void

interface MediaState {
  width: number
  darkScheme: boolean
  reducedMotion: boolean
}

const state: MediaState = { width: 1280, darkScheme: false, reducedMotion: false }
const registry = new Set<{ query: string; matches: () => boolean; listeners: Set<Listener> }>()

function evaluate(query: string): boolean {
  if (query.includes('prefers-color-scheme: dark')) return state.darkScheme
  if (query.includes('prefers-reduced-motion: reduce')) return state.reducedMotion
  const min = /min-width:\s*(\d+)px/.exec(query)
  const max = /max-width:\s*(\d+)px/.exec(query)
  if (!min && !max) return false
  return (!min || state.width >= Number(min[1])) && (!max || state.width <= Number(max[1]))
}

function notify() {
  for (const entry of registry) {
    const event = { matches: entry.matches(), media: entry.query } as MediaQueryListEvent
    entry.listeners.forEach((listener) => listener(event))
  }
}

export function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => {
      const listeners = new Set<Listener>()
      const entry = { query, matches: () => evaluate(query), listeners }
      registry.add(entry)
      return {
        get matches() {
          return evaluate(query)
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, listener: Listener) => listeners.add(listener),
        removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
        addListener: (listener: Listener) => listeners.add(listener),
        removeListener: (listener: Listener) => listeners.delete(listener),
        dispatchEvent: () => true,
      } as MediaQueryList
    },
  })
}

export function setViewportWidth(width: number) {
  state.width = width
  notify()
}

export function setPrefersDark(value: boolean) {
  state.darkScheme = value
  notify()
}

export function setPrefersReducedMotion(value: boolean) {
  state.reducedMotion = value
  notify()
}

export function resetMedia() {
  state.width = 1280
  state.darkScheme = false
  state.reducedMotion = false
  registry.clear()
}
