import { ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { StatusPill } from '@/components/common/StatusPill'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column, type SortState } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { LabelChip } from '@/components/common/LabelChip'
import { canEditTask, can } from '@/config/roles'
import { useProject } from '@/features/projects'
import { allowedStatusIds } from '@/features/projects/utils/workflow'
import { cn } from '@/lib/cn'
import { formatShortDate, isOverdueDate } from '@/lib/formatters'
import { useAuthStore } from '@/store/authStore'
import { StatusMenu } from '../components/StatusMenu'
import { TaskCreateModal } from '../components/TaskCreateModal'
import { BulkActionBar } from '../components/BulkActionBar'
import { SavedFilters } from '../components/SavedFilters'
import { TaskFilterBar } from '../components/TaskFilterBar'
import { savedParams, toListParams, useOpenTask, useTaskFilters } from '../hooks/useTaskFilters'
import { useTaskList, useUpdateTask } from '../hooks/useTasks'
import type { Task, TaskSortField } from '../types'

const PAGE_SIZE = 20
const SORTABLE: Record<string, TaskSortField> = {
  key: 'key',
  title: 'title',
  priority: 'priority',
  story_points: 'story_points',
  due_date: 'due_date',
  created_at: 'created_at',
}

export function ListViewPage() {
  const { projectId = '' } = useParams()
  const userId = useAuthStore((state) => state.user?.id)
  const project = useProject(projectId)
  const view = useTaskFilters('created_at')
  const tasks = useTaskList(projectId, toListParams(view, PAGE_SIZE))
  const update = useUpdateTask(projectId)
  const { open } = useOpenTask()
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  if (project.isPending) return null
  if (project.isError) return <ErrorState onRetry={() => void project.refetch()} />
  const statuses = project.data.statuses
  const role = project.data.my_role
  const statusOf = (task: Task) => statuses.find((status) => status.id === task.status_id)

  const columns: Column<Task>[] = [
    {
      key: 'key',
      header: 'Key',
      sortable: true,
      render: (task) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <IssueTypeIcon type={task.issue_type} />
          <span className="font-medium text-muted-foreground">{task.key}</span>
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Summary',
      sortable: true,
      render: (task) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {task.subtask_total > 0 && (
              <span>
                {task.subtask_done}/{task.subtask_total} subtasks
              </span>
            )}
            {task.labels.slice(0, 2).map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (task) => {
        const status = statusOf(task)
        if (!status) return null
        const pill = <StatusPill name={status.name} color={status.color} />
        if (!canEditTask(role, userId, task)) return pill
        return (
          <span
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <StatusMenu
              allowedIds={allowedStatusIds(project.data, task.status_id)}
              variant="custom"
              taskTitle={task.title}
              statuses={statuses}
              currentStatusId={task.status_id}
              onSelect={(statusId) =>
                update.mutate({ taskId: task.id, changes: { status_id: statusId } })
              }
            >
              {pill}
            </StatusMenu>
          </span>
        )
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (task) => <PriorityBadge priority={task.priority} />,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (task) =>
        task.assignee ? (
          <span className="inline-flex items-center gap-2">
            <Avatar
              name={task.assignee.name}
              color={task.assignee.avatar_color}
              size="sm"
              inactive={!task.assignee.is_active}
            />
            <span className="truncate">{task.assignee.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    {
      key: 'story_points',
      header: 'Points',
      sortable: true,
      render: (task) => task.story_points ?? '—',
    },
    {
      key: 'due_date',
      header: 'Due',
      sortable: true,
      render: (task) => (
        <span
          className={cn(
            isOverdueDate(task.due_date) && !task.completed_at && 'font-medium text-danger-fg',
          )}
        >
          {task.due_date ? formatShortDate(task.due_date) : '—'}
        </span>
      ),
    },
  ]

  const sort: SortState = { key: view.sort, direction: view.order }
  const hasFilters = view.activeCount > 0

  return (
    <section aria-label="Task list" className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">List</h2>
        {can(role, 'task:create') && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> New issue
          </Button>
        )}
      </div>
      <div className="mb-3">
        <SavedFilters
          projectId={projectId}
          current={savedParams(view)}
          canSave={view.activeCount > 0}
          onApply={view.replace}
        />
      </div>
      <TaskFilterBar
        projectId={projectId}
        filters={view.filters}
        statuses={statuses}
        activeCount={view.activeCount}
        onChange={(changes) => view.update(changes)}
        onClear={view.clear}
      />
      {tasks.isError ? (
        <ErrorState onRetry={() => void tasks.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Issues"
            selectedKeys={can(role, 'task:edit_own') ? selected : undefined}
            onSelectionChange={can(role, 'task:edit_own') ? setSelected : undefined}
            columns={columns}
            rows={tasks.data?.items ?? []}
            rowKey={(task) => task.id}
            loading={tasks.isPending}
            sort={sort}
            onSortChange={(next) => {
              if (SORTABLE[next.key]) view.update({ sort: next.key, order: next.direction })
            }}
            onRowClick={(task) => open(task.id)}
            rowLabel={(task) => `Open task ${task.title}`}
            empty={
              <EmptyState
                icon={ClipboardList}
                title={hasFilters ? 'No issues match these filters' : 'No issues yet'}
                description={
                  hasFilters ? 'Try removing a filter.' : 'Create the first issue for this project.'
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={view.clear}>
                      Clear filters
                    </Button>
                  ) : can(role, 'task:create') ? (
                    <Button onClick={() => setCreating(true)}>
                      <Plus size={16} aria-hidden="true" /> New issue
                    </Button>
                  ) : undefined
                }
              />
            }
          />
          {tasks.data && (
            <Pagination
              page={view.page}
              pageSize={PAGE_SIZE}
              total={tasks.data.total}
              onPageChange={(page) => view.update({ page: String(page) })}
            />
          )}
        </>
      )}
      {selected.size > 0 && (
        <BulkActionBar
          project={project.data}
          selected={[...selected]}
          onClear={() => setSelected(new Set())}
        />
      )}
      <TaskCreateModal open={creating} onClose={() => setCreating(false)} project={project.data} />
    </section>
  )
}
