import { seriesColor } from './chartTheme'

export interface BreakdownItem {
  key: string
  name: string
  count: number
  color?: string | null
}

interface BreakdownBarProps {
  items: BreakdownItem[]
  unit?: string
}

export function BreakdownBar({ items, unit = 'issues' }: BreakdownBarProps) {
  const visible = items
    .filter((item) => item.count > 0)
    .map((item, index) => ({ ...item, fill: item.color ?? seriesColor(index) }))
  const total = visible.reduce((sum, item) => sum + item.count, 0)
  if (total === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={`${total} ${unit}: ${visible.map((item) => `${item.name} ${item.count}`).join(', ')}`}
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-muted"
      >
        {visible.map((item) => (
          <span
            key={item.key}
            title={`${item.name}: ${item.count}`}
            style={{ width: `${(item.count / total) * 100}%`, backgroundColor: item.fill }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {visible.map((item) => (
          <li key={item.key} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-[3px]"
              style={{ backgroundColor: item.fill }}
            />
            <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
            <span className="font-medium tabular-nums">{item.count}</span>
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round((item.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
