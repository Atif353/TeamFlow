import { Layers, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { ProgressBar } from '@/components/common/ProgressBar'
import { StatusPill } from '@/components/common/StatusPill'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { CREATABLE_ISSUE_TYPES, ISSUE_TYPE_META, type IssueType } from '@/config/issueTypes'
import { routes } from '@/config/routes'
import type { Project } from '@/features/projects'
import { cn } from '@/lib/cn'
import { percent } from '@/lib/formatters'
import { useCreateTask, useEpicChildren } from '../../hooks/useTasks'
import type { Task } from '../../types'

interface ChildIssuesProps {
  epic: Task
  project: Project
  canCreate: boolean
}

const CHILD_TYPES = CREATABLE_ISSUE_TYPES.filter((type) => type !== 'epic')

export function ChildIssues({ epic, project, canCreate }: ChildIssuesProps) {
  const children = useEpicChildren(project.id, epic.id, true)
  const create = useCreateTask(project.id)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<IssueType>('story')
  const statuses = new Map(project.statuses.map((status) => [status.id, status]))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = title.trim()
    if (value)
      create.mutate(
        { title: value, issue_type: type, epic_id: epic.id },
        { onSuccess: () => setTitle('') },
      )
  }

  return (
    <section aria-labelledby="children-heading" className="flex flex-col gap-3">
      <h4 id="children-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Layers size={16} aria-hidden="true" /> Issues in this epic
        <span className="text-muted-foreground">
          {epic.child_done}/{epic.child_total}
        </span>
      </h4>
      {epic.child_total > 0 && (
        <ProgressBar value={percent(epic.child_done, epic.child_total)} label="Epic progress" />
      )}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {(children.data?.items ?? []).map((child) => {
          const status = statuses.get(child.status_id)
          return (
            <li key={child.id} className="flex items-center gap-3 px-3 py-2">
              <IssueTypeIcon type={child.issue_type} />
              <Link
                to={routes.issue(child.key)}
                className={cn(
                  'min-w-0 flex-1 truncate text-sm hover:underline',
                  child.completed_at && 'text-muted-foreground line-through',
                )}
              >
                <span className="mr-2 font-medium text-muted-foreground">{child.key}</span>
                {child.title}
              </Link>
              {status && <StatusPill name={status.name} color={status.color} />}
              {child.assignee && (
                <Avatar name={child.assignee.name} color={child.assignee.avatar_color} size="sm" />
              )}
            </li>
          )
        })}
      </ul>
      {children.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No issues in this epic yet.</p>
      )}
      {canCreate && (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="Child issue type"
            value={type}
            onChange={(event) => setType(event.target.value as IssueType)}
            options={CHILD_TYPES.map((item) => ({
              value: item,
              label: ISSUE_TYPE_META[item].label,
            }))}
            className="sm:w-40"
          />
          <Input
            aria-label="New child issue title"
            placeholder="What needs to be done?"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            aria-label="Add child issue"
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
