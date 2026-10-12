import { ListChecks, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ProgressBar } from '@/components/common/ProgressBar'
import { Checkbox } from '@/components/ui/Checkbox'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { percent } from '@/lib/formatters'
import { useChecklist } from '../hooks/useTasks'
import type { Task } from '../types'

interface ChecklistSectionProps {
  task: Task
  projectId: string
  editable: boolean
}

export function ChecklistSection({ task, projectId, editable }: ChecklistSectionProps) {
  const { add, toggle, remove } = useChecklist(projectId, task.id)
  const [text, setText] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (value) add.mutate(value, { onSuccess: () => setText('') })
  }

  return (
    <section aria-labelledby="checklist-heading" className="flex flex-col gap-3">
      <h4 id="checklist-heading" className="flex items-center gap-2 text-sm font-semibold">
        <ListChecks size={16} aria-hidden="true" /> Checklist
        <span className="text-muted-foreground">
          {task.checklist_done}/{task.checklist_total}
        </span>
      </h4>
      {task.checklist_total > 0 && (
        <ProgressBar
          value={percent(task.checklist_done, task.checklist_total)}
          label="Checklist progress"
        />
      )}
      <ul className="flex flex-col">
        {task.checklist.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <Checkbox
              label={item.text}
              checked={item.done}
              disabled={!editable}
              onChange={(event) => toggle.mutate({ itemId: item.id, done: event.target.checked })}
              className={item.done ? 'opacity-60 [&_label]:line-through' : undefined}
            />
            {editable && (
              <IconButton
                icon={Trash2}
                label={`Delete checklist item ${item.text}`}
                size="sm"
                onClick={() => remove.mutate(item.id)}
              />
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            aria-label="New checklist item"
            placeholder="Add an item"
            value={text}
            maxLength={200}
            onChange={(event) => setText(event.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            aria-label="Add checklist item"
            loading={add.isPending}
            disabled={!text.trim()}
          >
            <Plus size={16} aria-hidden="true" /> Add
          </Button>
        </form>
      )}
    </section>
  )
}
