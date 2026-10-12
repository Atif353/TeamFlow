import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

const COLOR_PRESETS = [
  '#6366F1',
  '#8B5CF6',
  '#0EA5E9',
  '#14B8A6',
  '#10B981',
  '#F59E0B',
  '#F97316',
  '#F43F5E',
  '#EC4899',
  '#64748B',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label: string
  className?: string
}

export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {COLOR_PRESETS.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
          >
            {selected && <Check size={14} aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
