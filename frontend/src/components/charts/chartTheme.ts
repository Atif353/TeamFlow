export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
] as const

export const AXIS_COLOR = 'rgb(var(--muted-foreground))'
export const GRID_COLOR = 'rgb(var(--border))'
export const SURFACE_COLOR = 'rgb(var(--surface))'

export const AXIS_PROPS = {
  tick: { fill: AXIS_COLOR, fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0]
}
