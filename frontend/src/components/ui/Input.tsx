import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const fieldClasses =
  'w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] md:min-h-[36px]'

export interface FieldShellProps {
  label?: string
  error?: string
  hint?: string
  id: string
  children: ReactNode
  className?: string
}

export function FieldShell({ label, error, hint, id, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, className, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell label={label} error={error} hint={hint} id={fieldId} className={className}>
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(fieldClasses, leftIcon && 'pl-9', error && 'border-danger')}
          {...props}
        />
      </div>
    </FieldShell>
  )
})
