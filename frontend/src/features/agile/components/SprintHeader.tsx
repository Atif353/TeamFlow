import { Pencil, Play, Square, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IconButton } from '@/components/ui/IconButton'
import { formatShortDate } from '@/lib/formatters'
import { useSprintActions } from '../hooks/useAgile'
import type { Sprint } from '../types'
import { CompleteSprintModal, SprintFormModal, StartSprintModal } from './SprintModals'

const STATE_TONE = { planned: 'neutral', active: 'success', completed: 'info' } as const

export function SprintTitle({ sprint }: { sprint: Sprint }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {sprint.name}
      <Badge tone={STATE_TONE[sprint.state]}>{sprint.state}</Badge>
      {sprint.start_date && sprint.end_date && (
        <span className="text-xs font-normal text-muted-foreground">
          {formatShortDate(sprint.start_date)} – {formatShortDate(sprint.end_date)}
        </span>
      )}
    </span>
  )
}

interface SprintActionsProps {
  sprint: Sprint
  projectId: string
  canPlan: boolean
  hasActive: boolean
  upcoming: Sprint[]
}

export function SprintActions({
  sprint,
  projectId,
  canPlan,
  hasActive,
  upcoming,
}: SprintActionsProps) {
  const { remove } = useSprintActions(projectId)
  const [dialog, setDialog] = useState<'start' | 'complete' | 'edit' | 'delete' | null>(null)
  if (!canPlan) return null
  const close = () => setDialog(null)

  return (
    <>
      {sprint.state === 'planned' && (
        <Button
          size="sm"
          variant="outline"
          disabled={hasActive}
          title={hasActive ? 'Complete the active sprint first' : undefined}
          onClick={() => setDialog('start')}
        >
          <Play size={14} aria-hidden="true" /> Start sprint
        </Button>
      )}
      {sprint.state === 'active' && (
        <Button size="sm" onClick={() => setDialog('complete')}>
          <Square size={14} aria-hidden="true" /> Complete sprint
        </Button>
      )}
      <IconButton
        icon={Pencil}
        label={`Edit ${sprint.name}`}
        size="sm"
        onClick={() => setDialog('edit')}
      />
      {sprint.state === 'planned' && (
        <IconButton
          icon={Trash2}
          label={`Delete ${sprint.name}`}
          size="sm"
          onClick={() => setDialog('delete')}
        />
      )}
      <SprintFormModal
        open={dialog === 'edit'}
        onClose={close}
        projectId={projectId}
        sprint={sprint}
        suggestedName={sprint.name}
      />
      <StartSprintModal
        open={dialog === 'start'}
        onClose={close}
        projectId={projectId}
        sprint={sprint}
      />
      <CompleteSprintModal
        open={dialog === 'complete'}
        onClose={close}
        projectId={projectId}
        sprint={sprint}
        upcoming={upcoming}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete sprint?"
        description={`${sprint.name} will be removed. Its issues return to the backlog.`}
        confirmLabel="Delete sprint"
        loading={remove.isPending}
        onCancel={close}
        onConfirm={() =>
          remove.mutate(sprint.id, {
            onSuccess: () => {
              toast.success('Sprint deleted')
              close()
            },
          })
        }
      />
    </>
  )
}
