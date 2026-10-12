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
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { can, canEditTask } from '@/config/roles'
import type { Project } from '@/features/projects'
import { isTransitionAllowed } from '@/features/projects/utils/workflow'
import { useCreateTask, useMoveTask, useOpenTask, type Task } from '@/features/tasks'
import { useAuthStore } from '@/store/authStore'
import { groupByStatus, isSamePlacement, neighborsOf, type ColumnItems } from '../utils/grouping'
import { BoardColumn } from './BoardColumn'
import { TaskCard } from './TaskCard'

interface BoardViewProps {
  project: Project
  tasks: Task[]
  allTasks: Task[]
  sprintId?: string
}

export function BoardView({ project, tasks, allTasks, sprintId }: BoardViewProps) {
  const userId = useAuthStore((state) => state.user?.id)
  const move = useMoveTask(project.id)
  const create = useCreateTask(project.id)
  const { open } = useOpenTask()
  const statuses = useMemo(
    () => [...project.statuses].sort((a, b) => a.order - b.order),
    [project.statuses],
  )
  const grouped = useMemo(() => groupByStatus(tasks, statuses), [tasks, statuses])
  const [drag, setDrag] = useState<{ items: ColumnItems; basis: Task[] } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const items = drag && drag.basis === tasks ? drag.items : grouped
  const setItems = (update: (previous: ColumnItems) => ColumnItems) =>
    setDrag((current) => ({
      basis: tasks,
      items: update(current && current.basis === tasks ? current.items : grouped),
    }))
  const taskById = useMemo(() => new Map(allTasks.map((task) => [task.id, task])), [allTasks])
  const role = project.my_role
  const readOnly = !can(role, 'task:edit_own')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )

  const containerOf = (id: string): string | undefined =>
    id in items ? id : Object.keys(items).find((key) => items[key]?.includes(id))

  const onDragStart = ({ active }: DragStartEvent) => {
    setDrag({ items: grouped, basis: tasks })
    setActiveId(String(active.id))
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = containerOf(activeKey)
    const to = containerOf(overKey)
    if (!from || !to || from === to) return
    setItems((previous) => {
      const target = previous[to] ?? []
      const overIndex = overKey in previous ? target.length : target.indexOf(overKey)
      const index = overIndex >= 0 ? overIndex : target.length
      return {
        ...previous,
        [from]: (previous[from] ?? []).filter((id) => id !== activeKey),
        [to]: [...target.slice(0, index), activeKey, ...target.slice(index)],
      }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id)
    setActiveId(null)
    if (!over) {
      setDrag(null)
      return
    }
    const overKey = String(over.id)
    const column = containerOf(activeKey)
    if (!column) return
    let next = items
    if (containerOf(overKey) === column) {
      const list = items[column] ?? []
      const oldIndex = list.indexOf(activeKey)
      const newIndex = overKey in items ? list.length - 1 : list.indexOf(overKey)
      if (oldIndex !== newIndex && newIndex >= 0) {
        next = { ...items, [column]: arrayMove(list, oldIndex, newIndex) }
        setDrag({ items: next, basis: tasks })
      }
    }
    const moving = taskById.get(activeKey)
    if (moving && !isTransitionAllowed(project, moving.status_id, column)) {
      toast.error('The workflow does not allow that status change')
      setDrag(null)
      return
    }
    const { previous, next: following } = neighborsOf(next[column] ?? [], activeKey)
    if (isSamePlacement(grouped, column, activeKey, previous, following)) return
    move.mutate({
      taskId: activeKey,
      status_id: column,
      previous_task_id: previous,
      next_task_id: following,
    })
  }

  const moveToStatus = (taskId: string, statusId: string) => {
    const column = groupByStatus(allTasks, statuses)[statusId] ?? []
    move.mutate({
      taskId,
      status_id: statusId,
      previous_task_id: column[column.length - 1] ?? null,
      next_task_id: null,
    })
  }

  const quickAdd = (statusId: string, title: string, done: () => void) =>
    create.mutate({ title, status_id: statusId, sprint_id: sprintId ?? null }, { onSuccess: done })

  const activeTask = activeId ? taskById.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDrag(null)
      }}
    >
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
        {statuses.map((status) => (
          <BoardColumn
            key={status.id}
            status={status}
            statuses={statuses}
            transitions={project.transitions}
            tasks={(items[status.id] ?? []).flatMap((id) => {
              const task = taskById.get(id)
              return task ? [task] : []
            })}
            canEditTask={(task) => canEditTask(role, userId, task)}
            readOnly={readOnly}
            canCreate={can(role, 'task:create')}
            creating={create.isPending && create.variables?.status_id === status.id}
            onOpen={open}
            onMoveTo={moveToStatus}
            onQuickAdd={quickAdd}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}
