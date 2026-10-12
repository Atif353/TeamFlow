import { Plus, Trash2, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PRIORITIES, PRIORITY_LABELS } from '@/components/common/priorities'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useRuleActions, useRules } from '@/features/agile/hooks/useAgile'
import type { AutomationAction, AutomationTrigger } from '@/features/agile/types'
import type { Priority } from '@/types/common'
import type { Project } from '../types'

const TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: 'status_changed', label: 'Issue moves to a status' },
  { value: 'issue_created', label: 'Issue is created' },
  { value: 'issue_assigned', label: 'Issue is assigned' },
]
const ACTIONS: { value: AutomationAction; label: string }[] = [
  { value: 'notify_assignee', label: 'Notify the assignee' },
  { value: 'notify_watchers', label: 'Notify watchers' },
  { value: 'set_priority', label: 'Set priority' },
  { value: 'flag_issue', label: 'Flag the issue' },
  { value: 'add_comment', label: 'Add a comment' },
]

export function AutomationManager({ project }: { project: Project }) {
  const rules = useRules(project.id)
  const { create, update, remove } = useRuleActions(project.id)
  const statuses = [...project.statuses].sort((a, b) => a.order - b.order)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<AutomationTrigger>('status_changed')
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? '')
  const [action, setAction] = useState<AutomationAction>('notify_assignee')
  const [priority, setPriority] = useState<Priority>('high')
  const [comment, setComment] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return toast.error('Give the rule a name')
    if (action === 'add_comment' && !comment.trim()) return toast.error('Write the comment text')
    const value =
      action === 'set_priority' ? priority : action === 'add_comment' ? comment.trim() : null
    create.mutate(
      {
        name: name.trim(),
        trigger,
        trigger_status_id: trigger === 'status_changed' ? statusId : null,
        action,
        action_value: value,
      },
      { onSuccess: () => setName('') },
    )
  }

  const statusName = (id: string | null) => statuses.find((item) => item.id === id)?.name

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={submit}
        noValidate
        className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
      >
        <Input
          label="Rule name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          className="sm:col-span-2"
        />
        <Select
          label="When"
          value={trigger}
          onChange={(event) => setTrigger(event.target.value as AutomationTrigger)}
          options={TRIGGERS}
        />
        {trigger === 'status_changed' && (
          <Select
            label="Status"
            value={statusId}
            onChange={(event) => setStatusId(event.target.value)}
            options={statuses.map((status) => ({ value: status.id, label: status.name }))}
          />
        )}
        <Select
          label="Then"
          value={action}
          onChange={(event) => setAction(event.target.value as AutomationAction)}
          options={ACTIONS}
        />
        {action === 'set_priority' && (
          <Select
            label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABELS[item] }))}
          />
        )}
        {action === 'add_comment' && (
          <Input
            label="Comment"
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
          />
        )}
        <div className="sm:col-span-2">
          <Button type="submit" loading={create.isPending}>
            <Plus size={16} aria-hidden="true" /> Add rule
          </Button>
        </div>
      </form>
      <ul className="flex flex-col gap-2">
        {(rules.data ?? []).map((rule) => (
          <li
            key={rule.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"
          >
            <Zap size={16} aria-hidden="true" />
            <span className="font-medium">{rule.name}</span>
            <span className="text-muted-foreground">
              {TRIGGERS.find((item) => item.value === rule.trigger)?.label}
              {rule.trigger_status_id
                ? ` “${statusName(rule.trigger_status_id) ?? '?'}”`
                : ''} → {ACTIONS.find((item) => item.value === rule.action)?.label}
            </span>
            <Badge tone="neutral">{rule.run_count} runs</Badge>
            <span className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                aria-pressed={rule.enabled}
                onClick={() => update.mutate({ id: rule.id, enabled: !rule.enabled })}
              >
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </Button>
              <IconButton
                icon={Trash2}
                label={`Delete rule ${rule.name}`}
                size="sm"
                onClick={() => remove.mutate(rule.id)}
              />
            </span>
          </li>
        ))}
        {rules.data?.length === 0 && (
          <li className="text-sm text-muted-foreground">No automation rules yet.</li>
        )}
      </ul>
    </div>
  )
}
