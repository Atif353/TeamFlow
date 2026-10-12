import { readableOn } from '@/lib/color'

interface StatusPillProps {
  name: string
  color: string
}

export function StatusPill({ name, color }: StatusPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color: readableOn(color) }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {name}
    </span>
  )
}
