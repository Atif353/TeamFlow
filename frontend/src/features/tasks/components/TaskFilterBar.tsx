import { FilterX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PRIORITIES, PRIORITY_LABELS } from '@/components/common/priorities'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { useDebounce } from '@/hooks/useDebounce'
import { useLabels, useProjectMembers } from '@/features/projects'
import type { ProjectStatus } from '@/features/projects/types'
import { CREATABLE_ISSUE_TYPES, ISSUE_TYPE_META } from '@/config/issueTypes'
import { useAllTasks } from '../hooks/useTasks'
import type { TaskFilterState } from '../types'

interface TaskFilterBarProps {
  projectId: string
  filters: TaskFilterState
  statuses?: ProjectStatus[]
  activeCount: number
  onChange: (changes: Partial<TaskFilterState>) => void
  onClear: () => void
}

export function TaskFilterBar({
  projectId,
  filters,
  statuses,
  activeCount,
  onChange,
  onClear,
}: TaskFilterBarProps) {
  const members = useProjectMembers(projectId)
  const labels = useLabels(projectId)
  const epics = useAllTasks(projectId, { issue_type: ['epic'] })
  const [text, setText] = useState(filters.q)
  const [seenQuery, setSeenQuery] = useState(filters.q)
  const debounced = useDebounce(text, 300)

  if (filters.q !== seenQuery) {
    setSeenQuery(filters.q)
    if (filters.q !== debounced) setText(filters.q)
  }

  useEffect(() => {
    if (debounced === text && debounced !== filters.q) onChange({ q: debounced })
  }, [debounced, text, filters.q, onChange])

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
      <SearchInput
        value={text}
        onChange={setText}
        placeholder="Search issues or keys"
        ariaLabel="Search issues"
        className="col-span-2 md:w-64"
      />
      <Select
        aria-label="Filter by assignee"
        value={filters.assignee}
        onChange={(event) => onChange({ assignee: event.target.value })}
        placeholder="All assignees"
        options={(members.data?.items ?? []).map((member) => ({
          value: member.user_id,
          label: member.name,
        }))}
        className="md:w-44"
      />
      <Select
        aria-label="Filter by priority"
        value={filters.priority}
        onChange={(event) => onChange({ priority: event.target.value })}
        placeholder="All priorities"
        options={PRIORITIES.map((priority) => ({
          value: priority,
          label: PRIORITY_LABELS[priority],
        }))}
        className="md:w-40"
      />
      <Select
        aria-label="Filter by label"
        value={filters.label}
        onChange={(event) => onChange({ label: event.target.value })}
        placeholder="All labels"
        options={(labels.data ?? []).map((label) => ({ value: label.id, label: label.name }))}
        className="md:w-40"
      />
      <Select
        aria-label="Filter by type"
        value={filters.type}
        onChange={(event) => onChange({ type: event.target.value })}
        placeholder="All types"
        options={[...CREATABLE_ISSUE_TYPES, 'subtask' as const].map((type) => ({
          value: type,
          label: ISSUE_TYPE_META[type].label,
        }))}
        className="md:w-40"
      />
      {(epics.data?.length ?? 0) > 0 && (
        <Select
          aria-label="Filter by epic"
          value={filters.epic}
          onChange={(event) => onChange({ epic: event.target.value })}
          placeholder="All epics"
          options={(epics.data ?? []).map((epic) => ({ value: epic.id, label: epic.title }))}
          className="md:w-44"
        />
      )}
      {statuses && (
        <Select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value })}
          placeholder="All statuses"
          options={[...statuses]
            .sort((a, b) => a.order - b.order)
            .map((status) => ({ value: status.id, label: status.name }))}
          className="md:w-40"
        />
      )}
      {activeCount > 0 && (
        <Button variant="ghost" onClick={onClear} className="col-span-2 md:col-span-1">
          <FilterX size={16} aria-hidden="true" /> Clear filters ({activeCount})
        </Button>
      )}
    </div>
  )
}
