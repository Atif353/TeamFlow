import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { ListTodo, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { can } from '@/config/roles'
import { useProject } from '@/features/projects'
import { useCreateTask, useRankTask, type Task } from '@/features/tasks'
import { BacklogRowContent } from '../components/BacklogRow'
import { BacklogSection } from '../components/BacklogSection'
import { EpicPanel } from '../components/EpicPanel'
import { SprintActions, SprintTitle } from '../components/SprintHeader'
import { SprintFormModal } from '../components/SprintModals'
import { useBacklog } from '../hooks/useAgile'
import type { Backlog } from '../types'

const BACKLOG = 'backlog'
type Containers = Record<string, string[]>

function matches(task: Task, text: string, epic: string): boolean {
  const needle = text.trim().toLowerCase()
  const textOk =
    !needle || task.title.toLowerCase().includes(needle) || task.key.toLowerCase().includes(needle)
  const epicOk = !epic || (epic === 'none' ? task.epic_id === null : task.epic_id === epic)
  return textOk && epicOk
}

function buildContainers(data: Backlog, text: string, epic: string): Containers {
  const result: Containers = {
    [BACKLOG]: data.backlog.filter((task) => matches(task, text, epic)).map((task) => task.id),
  }
  for (const entry of data.sprints) {
    result[entry.sprint.id] = entry.issues
      .filter((task) => matches(task, text, epic))
      .map((task) => task.id)
  }
  return result
}

export function BacklogPage() {
  const { projectId = '' } = useParams()
  const project = useProject(projectId)
  const backlog = useBacklog(projectId)
  const rank = useRankTask(projectId)
  const create = useCreateTask(projectId)
  const [text, setText] = useState('')
  const [epic, setEpic] = useState('')
  const [creatingSprint, setCreatingSprint] = useState(false)
  const [drag, setDrag] = useState<{ items: Containers; basis: Backlog } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const base = useMemo(
    () => (backlog.data ? buildContainers(backlog.data, text, epic) : {}),
    [backlog.data, text, epic],
  )
  const items = drag && drag.basis === backlog.data ? drag.items : base
  const tasks = useMemo(() => {
    const map = new Map<string, Task>()
    for (const task of backlog.data?.backlog ?? []) map.set(task.id, task)
    for (const entry of backlog.data?.sprints ?? [])
      for (const task of entry.issues) map.set(task.id, task)
    return map
  }, [backlog.data])
  const statuses = useMemo(
    () => new Map((project.data?.statuses ?? []).map((status) => [status.id, status])),
    [project.data],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (project.isError || backlog.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void project.refetch()
          void backlog.refetch()
        }}
      />
    )
  }
  if (project.isPending || backlog.isPending) {
    return (
      <div role="status" aria-label="Loading backlog" className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const data = backlog.data
  const role = project.data.my_role
  const canPlan = can(role, 'sprint:manage')
  const hasActive = data.sprints.some((entry) => entry.sprint.state === 'active')
  const containerOf = (id: string) =>
    id in items ? id : Object.keys(items).find((key) => items[key]?.includes(id))

  const moveItemsFor = (task: Task) => {
    if (!canPlan) return []
    const current = task.sprint_id ?? BACKLOG
    const targets = [
      ...(current === BACKLOG ? [] : [{ id: BACKLOG, name: 'Backlog' }]),
      ...data.sprints
        .filter((entry) => entry.sprint.id !== current)
        .map((entry) => ({ id: entry.sprint.id, name: entry.sprint.name })),
    ]
    return targets.map((target) => ({
      key: target.id,
      label: `Move to ${target.name}`,
      onSelect: () =>
        rank.mutate({
          taskId: task.id,
          previous_task_id: null,
          next_task_id: null,
          change_sprint: true,
          sprint_id: target.id === BACKLOG ? null : target.id,
        }),
    }))
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = containerOf(activeKey)
    const to = containerOf(overKey)
    if (!from || !to || from === to) return
    setDrag((current) => {
      const source = current && current.basis === data ? current.items : base
      const target = source[to] ?? []
      const overIndex = overKey in source ? target.length : target.indexOf(overKey)
      const index = overIndex >= 0 ? overIndex : target.length
      return {
        basis: data,
        items: {
          ...source,
          [from]: (source[from] ?? []).filter((id) => id !== activeKey),
          [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
        },
      }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id)
    setActiveId(null)
    if (!over) return setDrag(null)
    const column = containerOf(activeKey)
    const overKey = String(over.id)
    if (!column) return
    let next = items
    if (containerOf(overKey) === column) {
      const list = items[column] ?? []
      const from = list.indexOf(activeKey)
      const to = overKey in items ? list.length - 1 : list.indexOf(overKey)
      if (from !== to && to >= 0) {
        next = { ...items, [column]: arrayMove(list, from, to) }
        setDrag({ items: next, basis: data })
      }
    }
    const list = next[column] ?? []
    const position = list.indexOf(activeKey)
    const originalSprint = tasks.get(activeKey)?.sprint_id ?? BACKLOG
    const unchanged =
      column === originalSprint && (base[column] ?? []).indexOf(activeKey) === position
    if (unchanged) return setDrag(null)
    rank.mutate({
      taskId: activeKey,
      previous_task_id: list[position - 1] ?? null,
      next_task_id: list[position + 1] ?? null,
      change_sprint: column !== originalSprint,
      sprint_id: column === BACKLOG ? null : column,
    })
  }

  const rowsOf = (id: string): Task[] =>
    (items[id] ?? []).flatMap((taskId) => {
      const task = tasks.get(taskId)
      return task ? [task] : []
    })
  const activeTask = activeId ? tasks.get(activeId) : undefined
  const upcoming = data.sprints.filter((entry) => entry.sprint.state === 'planned')

  return (
    <section aria-label="Backlog" className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
      <EpicPanel epics={data.epics} selected={epic} onSelect={setEpic} />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            value={text}
            onChange={setText}
            placeholder="Search backlog"
            ariaLabel="Search backlog"
            className="w-full sm:w-64"
          />
          {canPlan && (
            <Button onClick={() => setCreatingSprint(true)}>
              <Plus size={16} aria-hidden="true" /> Create sprint
            </Button>
          )}
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => {
            setDrag({ items: base, basis: data })
            setActiveId(String(active.id))
          }}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null)
            setDrag(null)
          }}
        >
          {data.sprints.map(({ sprint }) => (
            <BacklogSection
              key={sprint.id}
              containerId={sprint.id}
              title={<SprintTitle sprint={sprint} />}
              meta={
                <span className="text-xs text-muted-foreground">
                  {sprint.done_count}/{sprint.issue_count} issues · {sprint.done_points}/
                  {sprint.story_points} pts
                </span>
              }
              actions={
                <SprintActions
                  sprint={sprint}
                  projectId={projectId}
                  canPlan={canPlan}
                  hasActive={hasActive}
                  upcoming={upcoming.map((entry) => entry.sprint).filter((s) => s.id !== sprint.id)}
                />
              }
              tasks={rowsOf(sprint.id)}
              statuses={statuses}
              draggable={canPlan}
              moveItemsFor={moveItemsFor}
              emptyMessage="Drag issues here or move them with the menu to plan this sprint."
            />
          ))}
          <BacklogSection
            containerId={BACKLOG}
            title={
              <span className="flex items-center gap-2">
                <ListTodo size={16} aria-hidden="true" /> Backlog
                <span className="font-normal text-muted-foreground">
                  {(items[BACKLOG] ?? []).length} issues
                </span>
              </span>
            }
            tasks={rowsOf(BACKLOG)}
            statuses={statuses}
            draggable={canPlan}
            moveItemsFor={moveItemsFor}
            creating={create.isPending}
            onQuickCreate={
              can(role, 'task:create')
                ? (title, done) => create.mutate({ title, issue_type: 'task' }, { onSuccess: done })
                : undefined
            }
            emptyMessage="The backlog is empty. Create an issue to get started."
          />
          <DragOverlay>
            {activeTask ? (
              <div className="rounded-lg border border-border bg-surface shadow-lift">
                <BacklogRowContent
                  task={activeTask}
                  status={statuses.get(activeTask.status_id)}
                  draggable={false}
                  moveItems={[]}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <SprintFormModal
        open={creatingSprint}
        onClose={() => setCreatingSprint(false)}
        projectId={projectId}
        suggestedName={`Sprint ${data.sprints.length + 1}`}
      />
    </section>
  )
}
