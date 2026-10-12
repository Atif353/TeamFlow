import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { PRIORITIES, PRIORITY_LABELS } from '@/components/common/priorities'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { IssueType } from '@/config/issueTypes'
import { can } from '@/config/roles'
import { useSprints, useVersions } from '@/features/agile/hooks/useAgile'
import { useProjectMembers, type Project } from '@/features/projects'
import { parseDuration } from '@/lib/duration'
import { applyApiErrors } from '@/lib/forms'
import { useAllTasks, useCreateTask } from '../hooks/useTasks'
import { useOpenTask } from '../hooks/useTaskFilters'
import { taskCreateSchema, type TaskCreateFormValues } from '../schemas/taskSchemas'
import { IssueTypePicker } from './IssueTypePicker'

interface TaskCreateModalProps {
  open: boolean
  onClose: () => void
  project: Project
  defaultStatusId?: string
  defaultType?: IssueType
  defaultEpicId?: string
  defaultSprintId?: string
  openAfterCreate?: boolean
}

const FORM_FIELDS = ['title', 'description', 'assignee_id', 'due_date', 'story_points'] as const

function CreateIssueDialog({
  onClose,
  project,
  defaultStatusId,
  defaultType = 'task',
  defaultEpicId = '',
  defaultSprintId = '',
  openAfterCreate = true,
}: Omit<TaskCreateModalProps, 'open'>) {
  const members = useProjectMembers(project.id)
  const epics = useAllTasks(project.id, { issue_type: ['epic'] })
  const sprints = useSprints(project.id, ['planned', 'active'])
  const versions = useVersions(project.id)
  const create = useCreateTask(project.id)
  const { open: openTask } = useOpenTask()
  const orderedStatuses = [...project.statuses].sort((a, b) => a.order - b.order)
  const firstStatus = defaultStatusId ?? orderedStatuses[0]?.id ?? ''
  const canPlan = can(project.my_role, 'sprint:manage')
  const initial: TaskCreateFormValues = {
    title: '',
    description: '',
    issue_type: defaultType,
    status_id: firstStatus,
    priority: 'medium',
    assignee_id: '',
    epic_id: defaultEpicId,
    sprint_id: defaultSprintId,
    version_id: '',
    start_date: '',
    due_date: '',
    story_points: '',
    estimate: '',
    environment: '',
  }
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<TaskCreateFormValues>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: initial,
  })
  const issueType = useWatch({ control, name: 'issue_type' }) as IssueType

  const onSubmit = handleSubmit((values) =>
    create.mutate(
      {
        title: values.title,
        description: values.description,
        issue_type: values.issue_type as IssueType,
        status_id: values.status_id,
        priority: values.priority,
        assignee_id: values.assignee_id || null,
        epic_id: values.epic_id || null,
        sprint_id: values.sprint_id || null,
        version_id: values.version_id || null,
        start_date: values.start_date || null,
        due_date: values.due_date || null,
        story_points: values.story_points === '' ? null : Number(values.story_points),
        original_estimate_minutes: values.estimate.trim() ? parseDuration(values.estimate) : null,
        environment: values.environment,
      },
      {
        onSuccess: (task) => {
          toast.success(`${task.key} created`)
          onClose()
          if (openAfterCreate) openTask(task.key)
        },
        onError: (error) => {
          const message = applyApiErrors(error, setError, FORM_FIELDS)
          if (message) toast.error(message)
        },
      },
    ),
  )

  const isEpic = issueType === 'epic'
  const showEnvironment = issueType === 'bug' || issueType === 'incident'

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Create issue"
      description={`${project.name} (${project.key})`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-create-form" loading={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="task-create-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <IssueTypePicker
          value={issueType}
          onChange={(type) => setValue('issue_type', type, { shouldDirty: true })}
        />
        <Input
          label="Summary"
          data-autofocus
          error={errors.title?.message}
          {...register('title')}
        />
        <Textarea
          label="Description"
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
        {showEnvironment && <Textarea label="Environment" rows={2} {...register('environment')} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Status"
            options={orderedStatuses.map((status) => ({ value: status.id, label: status.name }))}
            {...register('status_id')}
          />
          <Select
            label="Priority"
            options={PRIORITIES.map((priority) => ({
              value: priority,
              label: PRIORITY_LABELS[priority],
            }))}
            {...register('priority')}
          />
          <Select
            label="Assignee"
            placeholder="Unassigned"
            options={(members.data?.items ?? [])
              .filter((member) => member.is_active)
              .map((member) => ({ value: member.user_id, label: member.name }))}
            {...register('assignee_id')}
          />
          {!isEpic && (
            <Select
              label="Epic"
              placeholder="None"
              options={(epics.data ?? []).map((epic) => ({
                value: epic.id,
                label: `${epic.key} ${epic.title}`,
              }))}
              {...register('epic_id')}
            />
          )}
          {!isEpic && canPlan && (
            <Select
              label="Sprint"
              placeholder="Backlog"
              options={(sprints.data ?? []).map((sprint) => ({
                value: sprint.id,
                label: sprint.name,
              }))}
              {...register('sprint_id')}
            />
          )}
          <Select
            label="Fix version"
            placeholder="None"
            options={(versions.data ?? []).map((version) => ({
              value: version.id,
              label: version.name,
            }))}
            {...register('version_id')}
          />
          <DatePicker label="Start date" {...register('start_date')} />
          <DatePicker label="Due date" error={errors.due_date?.message} {...register('due_date')} />
          {!isEpic && (
            <Input
              label="Story points"
              inputMode="decimal"
              error={errors.story_points?.message}
              {...register('story_points')}
            />
          )}
          <Input
            label="Original estimate"
            hint="For example 2d 4h"
            error={errors.estimate?.message}
            {...register('estimate')}
          />
        </div>
      </form>
    </Modal>
  )
}

export function TaskCreateModal({ open, ...props }: TaskCreateModalProps) {
  return open ? <CreateIssueDialog {...props} /> : null
}
