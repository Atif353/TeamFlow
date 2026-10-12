import { readableOn } from '@/lib/color'

interface LabelChipProps {
  label: { name: string; color: string }
}

export function LabelChip({ label }: LabelChipProps) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${label.color}22`, color: readableOn(label.color) }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: label.color }}
        aria-hidden="true"
      />
      <span className="truncate">{label.name}</span>
    </span>
  )
}
