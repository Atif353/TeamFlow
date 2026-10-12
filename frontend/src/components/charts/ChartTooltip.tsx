interface TooltipEntry {
  name?: string | number
  value?: string | number | readonly (string | number)[]
  color?: string
  dataKey?: string | number
}

interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: readonly TooltipEntry[]
  formatLabel?: (label: string | number) => string
  formatValue?: (value: number, name: string) => string
}

export function ChartTooltip({
  active,
  label,
  payload,
  formatLabel,
  formatValue,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lift dark:shadow-none">
      {label !== undefined && (
        <p className="mb-1 font-medium text-foreground">
          {formatLabel ? formatLabel(label) : label}
        </p>
      )}
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry, index) => {
          const value = Array.isArray(entry.value) ? entry.value.join(' – ') : entry.value
          const name = String(entry.name ?? entry.dataKey ?? '')
          return (
            <li key={`${name}-${index}`} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{name}</span>
              <span className="ml-auto pl-3 font-medium text-foreground">
                {formatValue && typeof value === 'number' ? formatValue(value, name) : value}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
