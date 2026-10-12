import { addDays, format } from 'date-fns'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useSprintActions } from '../hooks/useAgile'
import type { Sprint } from '../types'

const DEFAULT_SPRINT_DAYS = 14

function isoDay(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

interface SprintFormModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  sprint?: Sprint
  suggestedName: string
}

interface SprintInputValues {
  name: string
  goal: string
  start_date: string | null
  end_date: string | null
}

function SprintForm({
  sprint,
  suggestedName,
  onSubmit,
}: {
  sprint?: Sprint
  suggestedName: string
  onSubmit: (input: SprintInputValues) => void
}) {
  const [name, setName] = useState(sprint?.name ?? suggestedName)
  const [goal, setGoal] = useState(sprint?.goal ?? '')
  const [start, setStart] = useState(sprint?.start_date ?? '')
  const [end, setEnd] = useState(sprint?.end_date ?? '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return toast.error('Sprint name is required')
    if (start && end && end < start) return toast.error('The end date cannot be before the start')
    onSubmit({
      name: name.trim(),
      goal: goal.trim(),
      start_date: start || null,
      end_date: end || null,
    })
  }

  return (
    <form id="sprint-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Input
        label="Sprint name"
        data-autofocus
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Textarea
        label="Sprint goal"
        rows={2}
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Start date"
          type="date"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <Input
          label="End date"
          type="date"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </div>
    </form>
  )
}

export function SprintFormModal({
  open,
  onClose,
  projectId,
  sprint,
  suggestedName,
}: SprintFormModalProps) {
  const { create, update } = useSprintActions(projectId)
  const save = (input: SprintInputValues) => {
    const done = { onSuccess: onClose }
    if (sprint) update.mutate({ id: sprint.id, input }, done)
    else create.mutate(input, done)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sprint ? 'Edit sprint' : 'Create sprint'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="sprint-form" loading={create.isPending || update.isPending}>
            {sprint ? 'Save' : 'Create sprint'}
          </Button>
        </>
      }
    >
      <SprintForm sprint={sprint} suggestedName={suggestedName} onSubmit={save} />
    </Modal>
  )
}

interface StartSprintModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  sprint: Sprint
}

function StartSprintForm({
  sprint,
  onSubmit,
}: {
  sprint: Sprint
  onSubmit: (from: string, to: string) => void
}) {
  const [from, setFrom] = useState(sprint.start_date ?? isoDay(new Date()))
  const [to, setTo] = useState(sprint.end_date ?? isoDay(addDays(new Date(), DEFAULT_SPRINT_DAYS)))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!from || !to || to < from) return toast.error('Choose a valid date range')
    onSubmit(from, to)
  }

  return (
    <form id="start-sprint-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Start date"
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
      <Input label="End date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
    </form>
  )
}

export function StartSprintModal({ open, onClose, projectId, sprint }: StartSprintModalProps) {
  const { start } = useSprintActions(projectId)
  const begin = (from: string, to: string) =>
    start.mutate(
      { id: sprint.id, start_date: from, end_date: to },
      {
        onSuccess: () => {
          toast.success(`${sprint.name} started`)
          onClose()
        },
      },
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Start ${sprint.name}`}
      description={`${sprint.issue_count} issues · ${sprint.story_points} story points will be committed.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="start-sprint-form" loading={start.isPending}>
            Start sprint
          </Button>
        </>
      }
    >
      <StartSprintForm sprint={sprint} onSubmit={begin} />
    </Modal>
  )
}

interface CompleteSprintModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  sprint: Sprint
  upcoming: Sprint[]
}

export function CompleteSprintModal({
  open,
  onClose,
  projectId,
  sprint,
  upcoming,
}: CompleteSprintModalProps) {
  const { complete } = useSprintActions(projectId)
  const [target, setTarget] = useState('')
  const unfinished = sprint.issue_count - sprint.done_count

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Complete ${sprint.name}`}
      description={`${sprint.done_count} issues are done and ${unfinished} are not.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={complete.isPending}
            onClick={() =>
              complete.mutate(
                { id: sprint.id, moveTo: target || null },
                {
                  onSuccess: () => {
                    toast.success(`${sprint.name} completed`)
                    onClose()
                  },
                },
              )
            }
          >
            Complete sprint
          </Button>
        </>
      }
    >
      <Select
        label="Move unfinished issues to"
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        options={[
          { value: '', label: 'Backlog' },
          ...upcoming.map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
    </Modal>
  )
}
