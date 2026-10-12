import { cn } from '@/lib/cn'
import { useLabels } from '@/features/projects'
import type { Label } from '@/features/projects/types'

interface LabelPickerProps {
  projectId: string
  selected: Label[]
  disabled: boolean
  onChange: (labels: Label[]) => void
}

export function LabelPicker({ projectId, selected, disabled, onChange }: LabelPickerProps) {
  const labels = useLabels(projectId)
  const selectedIds = new Set(selected.map((label) => label.id))

  if (labels.isPending) return <p className="text-sm text-muted-foreground">Loading labels…</p>
  if (!labels.data || labels.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No labels in this project yet.</p>
  }

  const toggle = (label: Label) =>
    onChange(
      selectedIds.has(label.id)
        ? selected.filter((item) => item.id !== label.id)
        : [...selected, label],
    )

  return (
    <div role="group" aria-label="Labels" className="flex flex-wrap gap-2">
      {labels.data.map((label) => {
        const active = selectedIds.has(label.id)
        return (
          <button
            key={label.id}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggle(label)}
            style={
              active
                ? { backgroundColor: label.color, color: '#fff', borderColor: label.color }
                : { color: label.color, borderColor: `${label.color}66` }
            }
            className={cn(
              'min-h-[32px] rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {label.name}
          </button>
        )
      })}
    </div>
  )
}
