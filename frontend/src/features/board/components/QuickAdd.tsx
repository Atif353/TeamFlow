import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface QuickAddProps {
  statusName: string
  loading: boolean
  onAdd: (title: string, done: () => void) => void
}

export function QuickAdd({ statusName, loading, onAdd }: QuickAddProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = title.trim()
    if (!value) return
    onAdd(value, () => setTitle(''))
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        fullWidth
        onClick={() => setOpen(true)}
        aria-label={`Add task to ${statusName}`}
      >
        <Plus size={16} aria-hidden="true" /> Add task
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input
        autoFocus
        aria-label={`New task title in ${statusName}`}
        placeholder="Task title"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setTitle('')
          }
        }}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={loading} disabled={!title.trim()}>
          Add
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false)
            setTitle('')
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
