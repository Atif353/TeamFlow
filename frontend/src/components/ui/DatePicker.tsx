import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { FieldShell, fieldClasses } from './Input'

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  { label, error, className, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell label={label} error={error} id={fieldId} className={className}>
      <input
        ref={ref}
        id={fieldId}
        type="date"
        aria-invalid={error ? true : undefined}
        className={cn(fieldClasses, error && 'border-danger')}
        {...props}
      />
    </FieldShell>
  )
})
