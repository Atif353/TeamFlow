import { Clock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { formatDuration, parseDuration } from '@/lib/duration'
import type { Task, TaskUpdateInput } from '../../types'
import { DetailRow } from './DetailRow'
import { InlineInput } from './InlineInput'
import { LogWorkModal } from './LogWorkModal'

interface TimeTrackingProps {
  task: Task
  projectId: string
  editable: boolean
  canLog: boolean
  onChange: (changes: TaskUpdateInput) => void
}

function EstimateField({
  id,
  label,
  minutes,
  disabled,
  onSave,
}: {
  id: string
  label: string
  minutes: number | null
  disabled: boolean
  onSave: (value: number | null) => void
}) {
  const commit = (text: string) => {
    if (!text.trim()) return onSave(null)
    const parsed = parseDuration(text)
    if (parsed === null) toast.error('Use a format like 2w 3d 4h 30m')
    else onSave(parsed)
  }
  return (
    <DetailRow label={label} htmlFor={id}>
      <InlineInput
        id={id}
        placeholder="e.g. 3h 30m"
        disabled={disabled}
        value={minutes === null ? '' : formatDuration(minutes)}
        onCommit={commit}
      />
    </DetailRow>
  )
}

export function TimeTracking({ task, projectId, editable, canLog, onChange }: TimeTrackingProps) {
  const [logging, setLogging] = useState(false)
  const original = task.original_estimate_minutes
  const remaining = task.remaining_estimate_minutes
  const spent = task.time_spent_minutes
  const total = spent + (remaining ?? 0)
  const loggedShare = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0
  const overrun = original !== null && spent > original

  return (
    <section aria-labelledby="time-tracking-heading" className="flex flex-col gap-2 pt-2">
      <h4 id="time-tracking-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Clock size={16} aria-hidden="true" /> Time tracking
      </h4>
      <div
        role="progressbar"
        aria-label="Time logged"
        aria-valuenow={loggedShare}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={overrun ? 'h-full bg-danger' : 'h-full bg-success'}
          style={{ width: `${loggedShare}%` }}
        />
      </div>
      <p className="flex justify-between text-xs text-muted-foreground">
        <span>{spent ? `${formatDuration(spent)} logged` : 'Nothing logged'}</span>
        <span>{remaining === null ? 'No estimate' : `${formatDuration(remaining)} remaining`}</span>
      </p>
      <EstimateField
        id="issue-original-estimate"
        label="Original estimate"
        minutes={original}
        disabled={!editable}
        onSave={(value) => onChange({ original_estimate_minutes: value })}
      />
      <EstimateField
        id="issue-remaining-estimate"
        label="Remaining"
        minutes={remaining}
        disabled={!editable}
        onSave={(value) => onChange({ remaining_estimate_minutes: value })}
      />
      {canLog && (
        <Button variant="outline" size="sm" onClick={() => setLogging(true)} className="self-start">
          <Clock size={14} aria-hidden="true" /> Log work
        </Button>
      )}
      <LogWorkModal
        open={logging}
        onClose={() => setLogging(false)}
        projectId={projectId}
        taskId={task.id}
        remaining={remaining}
      />
    </section>
  )
}
