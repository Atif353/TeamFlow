import { useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InlineInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  value: string
  onCommit: (value: string) => void
}

export function InlineInput({ value, onCommit, className, ...props }: InlineInputProps) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
      className={cn(
        'min-h-[40px] w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-border hover:bg-surface-muted focus-visible:border-primary-500 disabled:hover:border-transparent disabled:hover:bg-transparent md:min-h-[32px]',
        className,
      )}
      {...props}
    />
  )
}
