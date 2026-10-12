import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { formatDuration, parseDuration } from '@/lib/duration'
import { useWorklogActions } from '../../hooks/useIssueWork'

interface LogWorkModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  taskId: string
  remaining: number | null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LogWorkModal({ open, onClose, projectId, taskId, remaining }: LogWorkModalProps) {
  const { add } = useWorklogActions(projectId, taskId)
  const [spent, setSpent] = useState('')
  const [date, setDate] = useState(today())
  const [remainingText, setRemainingText] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string>()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const minutes = parseDuration(spent)
    if (minutes === null) return setError('Enter a time like 2h 30m')
    if (minutes > 60 * 24) return setError('A single entry cannot exceed 24 hours')
    const remainingMinutes = remainingText.trim() ? parseDuration(remainingText) : undefined
    if (remainingMinutes === null) return setError('Remaining estimate is not valid')
    setError(undefined)
    add.mutate(
      {
        minutes,
        started_at: new Date(`${date}T09:00:00`).toISOString(),
        comment: comment.trim(),
        remaining_minutes: remainingMinutes,
      },
      {
        onSuccess: () => {
          toast.success('Work logged')
          setSpent('')
          setRemainingText('')
          setComment('')
          onClose()
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log work"
      description="Record time spent on this issue."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="log-work-form" loading={add.isPending}>
            Log work
          </Button>
        </>
      }
    >
      <form id="log-work-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label="Time spent"
          hint="Use w, d, h and m — for example 1d 2h 30m"
          data-autofocus
          value={spent}
          error={error}
          onChange={(event) => setSpent(event.target.value)}
        />
        <Input
          label="Date started"
          type="date"
          value={date}
          max={today()}
          onChange={(event) => setDate(event.target.value)}
        />
        <Input
          label="Remaining estimate (optional)"
          hint={
            remaining === null
              ? 'Leave empty to keep the estimate unchanged'
              : `Currently ${formatDuration(remaining)}; leave empty to reduce it automatically`
          }
          value={remainingText}
          onChange={(event) => setRemainingText(event.target.value)}
        />
        <Textarea
          label="Work description"
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </form>
    </Modal>
  )
}
