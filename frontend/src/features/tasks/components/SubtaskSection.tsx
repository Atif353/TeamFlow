import { GitBranch, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ProgressBar } from '@/components/common/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import type { Project } from '@/features/projects'
import { percent } from '@/lib/formatters'
import { useCreateTask, useSubtasks, useUpdateTask } from '../hooks/useTasks'
import { useOpenTask } from '../hooks/useTaskFilters'
import type { Task } from '../types'

interface SubtaskSectionProps {
  task: Task
  project: Project
  canCreate: boolean
}

export function SubtaskSection({ task, project, canCreate }: SubtaskSectionProps) {
  const subtasks = useSubtasks(project.id, task.id)
  const create = useCreateTask(project.id)
  const update = useUpdateTask(project.id)
  const { open } = useOpenTask()
  const [title, setTitle] = useState('')
  const statuses = [...project.statuses].sort((a, b) => a.order - b.order)
  const doneStatus = statuses.find((status) => status.is_done)
  const openStatus = statuses.find((status) => !status.is_done)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = title.trim()
    if (value)
      create.mutate({ title: value, parent_id: task.id }, { onSuccess: () => setTitle('') })
  }

  const toggle = (subtask: Task, done: boolean) => {
    const target = done ? doneStatus : openStatus
    if (target) update.mutate({ taskId: subtask.id, changes: { status_id: target.id } })
  }

  return (
    <section aria-labelledby="subtasks-heading" className="flex flex-col gap-3">
      <h4 id="subtasks-heading" className="flex items-center gap-2 text-sm font-semibold">
        <GitBranch size={16} aria-hidden="true" /> Subtasks
        <span className="text-muted-foreground">
          {task.subtask_done}/{task.subtask_total}
        </span>
      </h4>
      {task.subtask_total > 0 && (
        <ProgressBar
          value={percent(task.subtask_done, task.subtask_total)}
          label="Subtask progress"
        />
      )}
      <ul className="flex flex-col">
        {(subtasks.data?.items ?? []).map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-2">
            <Checkbox
              label={`Mark ${subtask.title} done`}
              hideLabel
              checked={subtask.completed_at !== null}
              onChange={(event) => toggle(subtask, event.target.checked)}
            />
            <button
              type="button"
              onClick={() => open(subtask.id)}
              className="min-h-[44px] flex-1 truncate text-left text-sm hover:underline md:min-h-0"
            >
              {subtask.title}
            </button>
          </li>
        ))}
      </ul>
      {canCreate && (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            aria-label="New subtask title"
            placeholder="Add a subtask"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            aria-label="Add subtask"
            loading={create.isPending}
            disabled={!title.trim()}
          >
            <Plus size={16} aria-hidden="true" /> Add
          </Button>
        </form>
      )}
    </section>
  )
}
