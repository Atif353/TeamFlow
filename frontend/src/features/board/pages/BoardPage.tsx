import { Plus, Rocket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { can } from '@/config/roles'
import { useSprints } from '@/features/agile'
import { useProject } from '@/features/projects'
import {
  filterTasks,
  TaskCreateModal,
  TaskFilterBar,
  useBoardTasks,
  useTaskFilters,
} from '@/features/tasks'
import { formatShortDate } from '@/lib/formatters'
import { useAuthStore } from '@/store/authStore'
import { BoardView } from '../components/BoardView'
import { QuickFilters } from '../components/QuickFilters'
import { applyQuickFilters, type QuickFilter } from '../utils/quickFilters'

type Scope = 'active' | 'all'

export function BoardPage() {
  const { projectId = '' } = useParams()
  const project = useProject(projectId)
  const activeSprints = useSprints(projectId, ['active'])
  const activeSprint = activeSprints.data?.[0]
  const [chosen, setChosen] = useState<Scope | null>(null)
  const scope: Scope = chosen ?? (activeSprint ? 'active' : 'all')
  const sprintId = scope === 'active' ? activeSprint?.id : undefined
  const board = useBoardTasks(projectId, sprintId ?? 'all', sprintId ? { sprint_id: sprintId } : {})
  const view = useTaskFilters()
  const [creating, setCreating] = useState(false)
  const [quick, setQuick] = useState<ReadonlySet<QuickFilter>>(new Set())
  const userId = useAuthStore((state) => state.user?.id)
  const filtered = useMemo(
    () => applyQuickFilters(filterTasks(board.data ?? [], view.filters), quick, userId),
    [board.data, view.filters, quick, userId],
  )

  if (project.isError || board.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void project.refetch()
          void board.refetch()
        }}
      />
    )
  }

  return (
    <section aria-label="Kanban board">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Board</h2>
          {scope === 'active' && activeSprint && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Rocket size={14} aria-hidden="true" />
              {activeSprint.name}
              {activeSprint.end_date ? ` · ends ${formatShortDate(activeSprint.end_date)}` : ''}
              {activeSprint.goal ? ` · ${activeSprint.goal}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeSprint && (
            <Select
              aria-label="Board scope"
              value={scope}
              onChange={(event) => setChosen(event.target.value as Scope)}
              options={[
                { value: 'active', label: 'Active sprint' },
                { value: 'all', label: 'All issues' },
              ]}
              className="w-40"
            />
          )}
          {project.data && can(project.data.my_role, 'task:create') && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> New issue
            </Button>
          )}
        </div>
      </div>
      <TaskFilterBar
        projectId={projectId}
        filters={view.filters}
        activeCount={view.activeCount}
        onChange={(changes) => view.update(changes)}
        onClear={view.clear}
      />
      <QuickFilters
        active={quick}
        onToggle={(filter) =>
          setQuick((current) => {
            const next = new Set(current)
            if (next.has(filter)) next.delete(filter)
            else next.add(filter)
            return next
          })
        }
      />
      {project.isPending || board.isPending ? (
        <div role="status" aria-label="Loading board" className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-80 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <>
          <BoardView
            project={project.data}
            tasks={filtered}
            allTasks={board.data}
            sprintId={sprintId}
          />
          <TaskCreateModal
            open={creating}
            onClose={() => setCreating(false)}
            project={project.data}
            defaultSprintId={sprintId}
          />
        </>
      )}
    </section>
  )
}
