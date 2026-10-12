import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PRIORITIES, PRIORITY_LABELS } from '@/components/common/priorities'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { Select } from '@/components/ui/Select'
import { can } from '@/config/roles'
import { useProjectMembers, type Project } from '@/features/projects'
import type { Priority } from '@/types/common'
import { useBulkTasks } from '../hooks/useTasks'
import type { BulkResult, TaskUpdateInput } from '../types'

interface BulkActionBarProps {
  project: Project
  selected: string[]
  onClear: () => void
}

function summarize(result: BulkResult, outcome: string) {
  const first = result.failed[0]
  if (!first) return toast.success(`${result.succeeded} issues ${outcome}`)
  toast.error(
    `${result.succeeded} issues ${outcome}, ${result.failed.length} failed: ${first.message}`,
  )
}

export function BulkActionBar({ project, selected, onClear }: BulkActionBarProps) {
  const members = useProjectMembers(project.id)
  const bulk = useBulkTasks(project.id)
  const [confirming, setConfirming] = useState(false)
  const statuses = [...project.statuses].sort((a, b) => a.order - b.order)
  const canDelete = can(project.my_role, 'task:delete_own')

  const apply = (changes: TaskUpdateInput) =>
    bulk.mutate(
      { taskIds: selected, action: { changes } },
      {
        onSuccess: (result) => {
          summarize(result, 'updated')
          onClear()
        },
      },
    )

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3 shadow-lift dark:shadow-none"
    >
      <p className="mr-auto self-center text-sm font-medium">{selected.length} selected</p>
      <Select
        aria-label="Move selected to status"
        placeholder="Move to…"
        value=""
        onChange={(event) => event.target.value && apply({ status_id: event.target.value })}
        options={statuses.map((status) => ({ value: status.id, label: status.name }))}
        className="w-40"
      />
      <Select
        aria-label="Assign selected to"
        placeholder="Assign to…"
        value=""
        onChange={(event) => event.target.value && apply({ assignee_id: event.target.value })}
        options={(members.data?.items ?? [])
          .filter((member) => member.is_active)
          .map((member) => ({ value: member.user_id, label: member.name }))}
        className="w-40"
      />
      <Select
        aria-label="Set priority of selected"
        placeholder="Priority…"
        value=""
        onChange={(event) =>
          event.target.value && apply({ priority: event.target.value as Priority })
        }
        options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))}
        className="w-36"
      />
      {canDelete && (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <Trash2 size={16} aria-hidden="true" /> Delete
        </Button>
      )}
      <IconButton icon={X} label="Clear selection" onClick={onClear} />
      <ConfirmDialog
        open={confirming}
        title={`Delete ${selected.length} issues?`}
        description="The selected issues, their subtasks, comments and work logs will be permanently deleted."
        confirmLabel="Delete issues"
        loading={bulk.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          bulk.mutate(
            { taskIds: selected, action: { delete: true } },
            {
              onSuccess: (result) => {
                summarize(result, 'deleted')
                setConfirming(false)
                onClear()
              },
            },
          )
        }
      />
    </div>
  )
}
