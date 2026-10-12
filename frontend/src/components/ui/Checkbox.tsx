import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  hideLabel?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hideLabel = false, className, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <div className={cn('flex min-h-[44px] items-center gap-2 md:min-h-0', className)}>
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-border accent-primary-600"
        {...props}
      />
      <label
        htmlFor={fieldId}
        className={cn('cursor-pointer text-sm text-foreground', hideLabel && 'sr-only')}
      >
        {label}
      </label>
    </div>
  )
})
