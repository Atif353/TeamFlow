import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { FieldShell, fieldClasses } from './Input'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell label={label} error={error} hint={hint} id={fieldId} className={className}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(fieldClasses, 'pr-8', error && 'border-danger')}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
})
