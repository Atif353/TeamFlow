import type { ReactNode } from 'react'

interface DetailRowProps {
  label: string
  htmlFor?: string
  children: ReactNode
}

export function DetailRow({ label, htmlFor, children }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 py-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}
