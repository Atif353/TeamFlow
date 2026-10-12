import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import type { DropdownItem } from '@/components/ui/Dropdown'
import type { ProjectStatus } from '@/features/projects'
import type { Task } from '@/features/tasks'
import { cn } from '@/lib/cn'
import { SortableBacklogRow } from './BacklogRow'

interface BacklogSectionProps {
  containerId: string
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  tasks: Task[]
  statuses: Map<string, ProjectStatus>
  draggable: boolean
  moveItemsFor: (task: Task) => DropdownItem[]
  onQuickCreate?: (title: string, done: () => void) => void
  creating?: boolean
  emptyMessage: string
}

export function BacklogSection({
  containerId,
  title,
  meta,
  actions,
  tasks,
  statuses,
  draggable,
  moveItemsFor,
  onQuickCreate,
  creating = false,
  emptyMessage,
}: BacklogSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const { setNodeRef, isOver } = useDroppable({ id: containerId })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (value && onQuickCreate) {
      onQuickCreate(value, () => setText(''))
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted/50 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="flex min-h-[40px] min-w-0 items-center gap-2 text-left text-sm font-semibold"
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
          {title}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {meta}
          {actions}
        </div>
      </div>
      {!collapsed && (
        <>
          <ul
            ref={setNodeRef}
            aria-label={typeof title === 'string' ? title : 'Issues'}
            className={cn('min-h-[44px]', isOver && 'bg-primary-50')}
          >
            <SortableContext
              items={tasks.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              {tasks.map((task) => (
                <SortableBacklogRow
                  key={task.id}
                  task={task}
                  status={statuses.get(task.status_id)}
                  draggable={draggable}
                  moveItems={moveItemsFor(task)}
                />
              ))}
            </SortableContext>
            {tasks.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">{emptyMessage}</li>
            )}
          </ul>
          {onQuickCreate && (
            <div className="border-t border-border p-2">
              {adding ? (
                <form onSubmit={submit} className="flex gap-2">
                  <Input
                    aria-label="New issue summary"
                    placeholder="What needs to be done?"
                    value={text}
                    maxLength={200}
                    autoFocus
                    onChange={(event) => setText(event.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" loading={creating} disabled={!text.trim()}>
                    Create
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                  <Plus size={14} aria-hidden="true" /> Create issue
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
