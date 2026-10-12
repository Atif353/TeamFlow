import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InlineSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  placeholder?: string
}

export function InlineSelect({ options, placeholder, className, ...props }: InlineSelectProps) {
  return (
    <select
      className={cn(
        'min-h-[40px] w-full truncate rounded-lg border border-transparent bg-transparent px-2 text-sm text-foreground transition-colors hover:border-border hover:bg-surface-muted focus-visible:border-primary-500 disabled:cursor-default disabled:opacity-100 disabled:hover:border-transparent disabled:hover:bg-transparent md:min-h-[32px]',
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
