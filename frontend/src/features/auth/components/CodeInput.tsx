import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

const LENGTH = 6

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  invalid?: boolean
  disabled?: boolean
}

export function CodeInput({ value, onChange, onComplete, invalid, disabled }: CodeInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: LENGTH }, (_, index) => value[index] ?? '')

  const commit = (next: string, focusIndex: number) => {
    onChange(next)
    inputs.current[Math.min(focusIndex, LENGTH - 1)]?.focus()
    if (next.length === LENGTH) onComplete?.(next)
  }

  const onInput = (index: number, raw: string) => {
    const entered = raw.replace(/\D/g, '')
    if (!entered) return
    const next = (value.slice(0, index) + entered).slice(0, LENGTH)
    commit(next, index + entered.length)
  }

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (digits[index]) commit(value.slice(0, index) + value.slice(index + 1), index)
      else if (index > 0) commit(value.slice(0, index - 1), index - 1)
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return
    event.preventDefault()
    commit(pasted, pasted.length)
  }

  return (
    <div role="group" aria-label="6-digit verification code" className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={LENGTH}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          onChange={(event) => onInput(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
          className={cn(
            'h-12 w-full min-w-0 rounded-md border bg-surface text-center font-mono text-xl font-semibold tabular-nums transition-colors focus-visible:border-primary-500 disabled:opacity-60 sm:h-14',
            invalid ? 'border-danger' : 'border-border',
          )}
        />
      ))}
    </div>
  )
}
