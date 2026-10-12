import { toast } from 'sonner'
import { PRIORITIES, PRIORITY_LABELS } from '@/components/common/priorities'
import { Avatar } from '@/components/ui/Avatar'
import { CREATABLE_ISSUE_TYPES, ISSUE_TYPE_META, type IssueType } from '@/config/issueTypes'
import { useSprints, useVersions } from '@/features/agile/hooks/useAgile'
import { useProjectMembers, type Label, type Project } from '@/features/projects'
import { allowedStatusIds } from '@/features/projects/utils/workflow'
import { formatDate } from '@/lib/formatters'
import type { Priority } from '@/types/common'
import { useAllTasks } from '../../hooks/useTasks'
import type { Task, TaskUpdateInput } from '../../types'
import { LabelPicker } from '../LabelPicker'
import { DetailRow } from './DetailRow'
import { InlineInput } from './InlineInput'
import { InlineSelect } from './InlineSelect'

interface IssueDetailsProps {
  task: Task
  project: Project
  editable: boolean
  canPlan: boolean
  onChange: (changes: TaskUpdateInput, optimistic?: Partial<Task>) => void
}

function parsePoints(value: string): number | null | undefined {
  const text = value.trim()
  if (!text) return null
  const parsed = Number(text)
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1000) return undefined
  return parsed
}

export function IssueDetails({ task, project, editable, canPlan, onChange }: IssueDetailsProps) {
  const members = useProjectMembers(project.id)
  const sprints = useSprints(project.id, ['planned', 'active'])
  const versions = useVersions(project.id)
  const epics = useAllTasks(project.id, { issue_type: ['epic'] })
  const statuses = [...project.statuses].sort((a, b) => a.order - b.order)
  const reachable = allowedStatusIds(project, task.status_id)
  const isSubtask = task.issue_type === 'subtask'
  const isEpic = task.issue_type === 'epic'
  const people = (members.data?.items ?? []).filter(
    (member) => member.is_active || member.user_id === task.assignee_id,
  )

  const assign = (userId: string | null) => {
    const member = members.data?.items.find((item) => item.user_id === userId)
    onChange(
      { assignee_id: userId },
      {
        assignee_id: userId,
        assignee: member
          ? {
              id: member.user_id,
              name: member.name,
              avatar_color: member.avatar_color,
              is_active: member.is_active,
            }
          : null,
      },
    )
  }

  const savePoints = (value: string) => {
    const parsed = parsePoints(value)
    if (parsed === undefined) toast.error('Story points must be a number from 0 to 1000')
    else onChange({ story_points: parsed })
  }

  const typeOptions = (isSubtask ? (['subtask'] as IssueType[]) : CREATABLE_ISSUE_TYPES).map(
    (type) => ({ value: type, label: ISSUE_TYPE_META[type].label }),
  )

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="pb-2">
        <DetailRow label="Status" htmlFor="issue-status">
          <InlineSelect
            id="issue-status"
            disabled={!editable}
            value={task.status_id}
            onChange={(event) => onChange({ status_id: event.target.value })}
            options={statuses
              .filter((status) => reachable.has(status.id))
              .map((status) => ({ value: status.id, label: status.name }))}
          />
        </DetailRow>
        <DetailRow label="Assignee" htmlFor="issue-assignee">
          <div className="flex items-center gap-1">
            {task.assignee && (
              <Avatar
                name={task.assignee.name}
                color={task.assignee.avatar_color}
                size="sm"
                inactive={!task.assignee.is_active}
              />
            )}
            <InlineSelect
              id="issue-assignee"
              disabled={!editable}
              value={task.assignee_id ?? ''}
              onChange={(event) => assign(event.target.value || null)}
              placeholder="Unassigned"
              options={people.map((member) => ({
                value: member.user_id,
                label: member.is_active ? member.name : `${member.name} (deactivated)`,
              }))}
            />
          </div>
        </DetailRow>
        <DetailRow label="Reporter">
          <span className="flex items-center gap-2 px-2">
            {task.creator && (
              <Avatar
                name={task.creator.name}
                color={task.creator.avatar_color}
                size="sm"
                inactive={!task.creator.is_active}
              />
            )}
            {task.creator?.name ?? 'Unknown'}
          </span>
        </DetailRow>
        <DetailRow label="Priority" htmlFor="issue-priority">
          <InlineSelect
            id="issue-priority"
            disabled={!editable}
            value={task.priority}
            onChange={(event) => onChange({ priority: event.target.value as Priority })}
            options={PRIORITIES.map((priority) => ({
              value: priority,
              label: PRIORITY_LABELS[priority],
            }))}
          />
        </DetailRow>
        <DetailRow label="Type" htmlFor="issue-type">
          <InlineSelect
            id="issue-type"
            disabled={!editable || isSubtask}
            value={task.issue_type}
            onChange={(event) => onChange({ issue_type: event.target.value as IssueType })}
            options={typeOptions}
          />
        </DetailRow>
        <DetailRow label="Labels">
          <LabelPicker
            projectId={project.id}
            selected={task.labels}
            disabled={!editable}
            onChange={(labels: Label[]) =>
              onChange({ label_ids: labels.map((label) => label.id) }, { labels })
            }
          />
        </DetailRow>
        {project.components.length > 0 && (
          <DetailRow label="Components">
            <div role="group" aria-label="Components" className="flex flex-wrap gap-1.5">
              {project.components.map((name) => {
                const active = task.components.includes(name)
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    disabled={!editable}
                    onClick={() =>
                      onChange({
                        components: active
                          ? task.components.filter((item) => item !== name)
                          : [...task.components, name],
                      })
                    }
                    className={
                      active
                        ? 'rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-text'
                        : 'rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-surface-muted disabled:hover:bg-transparent'
                    }
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </DetailRow>
        )}
      </div>

      <div className="py-2">
        {!isSubtask && !isEpic && (
          <DetailRow label="Sprint" htmlFor="issue-sprint">
            <InlineSelect
              id="issue-sprint"
              disabled={!editable || !canPlan}
              value={task.sprint_id ?? ''}
              onChange={(event) => onChange({ sprint_id: event.target.value || null })}
              placeholder="None"
              options={(sprints.data ?? []).map((sprint) => ({
                value: sprint.id,
                label: sprint.state === 'active' ? `${sprint.name} (active)` : sprint.name,
              }))}
            />
          </DetailRow>
        )}
        {!isSubtask && !isEpic && (
          <DetailRow label="Epic" htmlFor="issue-epic">
            <InlineSelect
              id="issue-epic"
              disabled={!editable}
              value={task.epic_id ?? ''}
              onChange={(event) => onChange({ epic_id: event.target.value || null })}
              placeholder="None"
              options={(epics.data ?? []).map((epic) => ({
                value: epic.id,
                label: `${epic.key} ${epic.title}`,
              }))}
            />
          </DetailRow>
        )}
        <DetailRow label="Fix version" htmlFor="issue-version">
          <InlineSelect
            id="issue-version"
            disabled={!editable}
            value={task.version_id ?? ''}
            onChange={(event) => onChange({ version_id: event.target.value || null })}
            placeholder="None"
            options={(versions.data ?? []).map((version) => ({
              value: version.id,
              label: version.name,
            }))}
          />
        </DetailRow>
        <DetailRow label="Story points" htmlFor="issue-points">
          <InlineInput
            id="issue-points"
            inputMode="decimal"
            placeholder="None"
            disabled={!editable || isEpic}
            value={task.story_points === null ? '' : String(task.story_points)}
            onCommit={savePoints}
          />
        </DetailRow>
        <DetailRow label="Start date" htmlFor="issue-start">
          <InlineInput
            id="issue-start"
            type="date"
            disabled={!editable}
            value={task.start_date ?? ''}
            onCommit={(value) => onChange({ start_date: value || null })}
          />
        </DetailRow>
        <DetailRow label="Due date" htmlFor="issue-due">
          <InlineInput
            id="issue-due"
            type="date"
            disabled={!editable}
            value={task.due_date ?? ''}
            onCommit={(value) => onChange({ due_date: value || null })}
          />
        </DetailRow>
      </div>

      <div className="pt-2 text-xs text-muted-foreground">
        <DetailRow label="Created">{formatDate(task.created_at)}</DetailRow>
        <DetailRow label="Updated">{formatDate(task.updated_at)}</DetailRow>
        {task.completed_at && (
          <DetailRow label="Resolved">{formatDate(task.completed_at)}</DetailRow>
        )}
      </div>
    </div>
  )
}
