import { cn } from '@/lib/cn'
import type { QuickFilter } from '../utils/quickFilters'

const FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'mine', label: 'Only my issues' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'blocked', label: 'Blocked' },
]

interface QuickFiltersProps {
  active: ReadonlySet<QuickFilter>
  onToggle: (filter: QuickFilter) => void
}

export function QuickFilters({ active, onToggle }: QuickFiltersProps) {
  return (
    <div role="group" aria-label="Quick filters" className="mb-4 flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const pressed = active.has(filter.value)
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(filter.value)}
            className={cn(
              'min-h-[36px] rounded-full border px-3 text-sm transition-colors',
              pressed
                ? 'border-primary-500 bg-primary-50 font-medium text-primary-text'
                : 'border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
