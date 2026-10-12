import { useState } from 'react'
import { fieldClasses } from '@/components/ui/Input'
import { cn } from '@/lib/cn'

interface TaskTitleProps {
  value: string
  editable: boolean
  onSave: (title: string) => void
}

export function TaskTitle({ value, editable, onSave }: TaskTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const title = draft.trim()
    setEditing(false)
    if (title && title !== value) onSave(title)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        aria-label="Task title"
        autoFocus
        maxLength={200}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') {
            event.stopPropagation()
            setDraft(value)
            setEditing(false)
          }
        }}
        className={cn(fieldClasses, 'text-lg font-semibold')}
      />
    )
  }

  return (
    <h3 className="text-lg font-semibold leading-7">
      {editable ? (
        <button
          type="button"
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
          aria-label={`Edit title: ${value}`}
          className="w-full rounded-lg px-2 py-1 text-left hover:bg-surface-muted"
        >
          {value}
        </button>
      ) : (
        <span className="px-2">{value}</span>
      )}
    </h3>
  )
}
