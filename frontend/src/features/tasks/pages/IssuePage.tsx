import { ArrowLeft, Copy, Eye, EyeOff, Flag, Link2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { can, canDeleteTask, canEditTask } from '@/config/roles'
import { routes } from '@/config/routes'
import { useProject } from '@/features/projects'
import { toApiError } from '@/lib/axios'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { ChecklistSection } from '../components/ChecklistSection'
import { SubtaskSection } from '../components/SubtaskSection'
import { TaskDescription } from '../components/TaskDescription'
import { TaskTitle } from '../components/TaskTitle'
import { AttachmentsSection } from '../components/issue/AttachmentsSection'
import { ChildIssues } from '../components/issue/ChildIssues'
import { IssueActivity } from '../components/issue/IssueActivity'
import { IssueDetails } from '../components/issue/IssueDetails'
import { IssueLinks } from '../components/issue/IssueLinks'
import { TimeTracking } from '../components/issue/TimeTracking'
import { useCloneTask, useDeleteTask, useTask, useUpdateTask, useWatch } from '../hooks/useTasks'
import type { Task, TaskUpdateInput } from '../types'

function IssueSkeleton() {
  return (
    <div role="status" aria-label="Loading issue" className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <SkeletonList rows={6} />
      <SkeletonList rows={8} />
    </div>
  )
}

export function IssuePage() {
  const { ref = '' } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.user?.id)
  const task = useTask(ref)
  const project = useProject(task.data?.project_id ?? '')
  const projectId = task.data?.project_id ?? ''
  const update = useUpdateTask(projectId)
  const remove = useDeleteTask(projectId)
  const watch = useWatch(projectId, task.data?.id ?? '')
  const clone = useCloneTask(projectId)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (task.data && ref !== task.data.key) navigate(routes.issue(task.data.key), { replace: true })
  }, [task.data, ref, navigate])

  useEffect(() => {
    if (task.data) document.title = `[${task.data.key}] ${task.data.title} · TeamFlow`
    return () => {
      document.title = 'TeamFlow'
    }
  }, [task.data])

  if (task.isPending || (task.isSuccess && project.isPending)) return <IssueSkeleton />
  if (task.isError) {
    const notFound = toApiError(task.error).code === 'task_not_found'
    return notFound ? (
      <EmptyState
        icon={Link2}
        title="Issue not found"
        description="This issue does not exist or you do not have access to it."
        action={
          <Link to={routes.projects} className="text-sm font-medium text-primary-text underline">
            Back to projects
          </Link>
        }
      />
    ) : (
      <ErrorState onRetry={() => void task.refetch()} />
    )
  }
  if (project.isError) return <ErrorState onRetry={() => void project.refetch()} />
  const proj = project.data
  if (!proj) return <IssueSkeleton />

  const data: Task = task.data
  const role = proj.my_role
  const editable = canEditTask(role, userId, data)
  const deletable = canDeleteTask(role, userId, data)
  const canLog = can(role, 'task:create')
  const manageAny = can(role, 'task:edit_any')
  const isEpic = data.issue_type === 'epic'
  const save = (changes: TaskUpdateInput, optimistic?: Partial<Task>) =>
    update.mutate({ taskId: data.id, changes, optimistic })

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link to={routes.projects} className="text-muted-foreground hover:underline">
          Projects
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={routes.summary(proj.id)} className="text-muted-foreground hover:underline">
          {proj.name}
        </Link>
        {data.epic && (
          <>
            <span aria-hidden="true">/</span>
            <Link
              to={routes.issue(data.epic.key)}
              className="text-muted-foreground hover:underline"
            >
              {data.epic.key}
            </Link>
          </>
        )}
        {data.parent && (
          <>
            <span aria-hidden="true">/</span>
            <Link
              to={routes.issue(data.parent.key)}
              className="text-muted-foreground hover:underline"
            >
              {data.parent.key}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="flex items-center gap-1.5 font-medium">
          <IssueTypeIcon type={data.issue_type} />
          {data.key}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <TaskTitle
            key={data.title}
            value={data.title}
            editable={editable}
            onSave={(title) => save({ title })}
          />
          {!editable && (
            <p className="px-2 text-xs text-muted-foreground">
              {can(role, 'task:edit_own')
                ? 'You can only edit issues you created or are assigned to.'
                : 'You have read-only access to this project.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.flagged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning-fg">
              <Flag size={12} aria-hidden="true" /> Flagged
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            loading={watch.isPending}
            aria-pressed={data.is_watching}
            onClick={() => watch.mutate(!data.is_watching)}
          >
            {data.is_watching ? (
              <EyeOff size={14} aria-hidden="true" />
            ) : (
              <Eye size={14} aria-hidden="true" />
            )}
            {data.is_watching ? 'Stop watching' : 'Watch'}
            <span className="text-muted-foreground">{data.watchers.length}</span>
          </Button>
          {editable && (
            <Button
              variant="outline"
              size="sm"
              aria-pressed={data.flagged}
              onClick={() => save({ flagged: !data.flagged }, { flagged: !data.flagged })}
            >
              <Flag size={14} aria-hidden="true" /> {data.flagged ? 'Remove flag' : 'Flag'}
            </Button>
          )}
          {canLog && (
            <Button
              variant="outline"
              size="sm"
              loading={clone.isPending}
              onClick={() =>
                clone.mutate(data.id, {
                  onSuccess: (copy) => {
                    toast.success(`${copy.key} created`)
                    navigate(routes.issue(copy.key))
                  },
                })
              }
            >
              <Copy size={14} aria-hidden="true" /> Clone
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void copyLink()}>
            <Link2 size={14} aria-hidden="true" /> Copy link
          </Button>
          {deletable && (
            <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 size={14} aria-hidden="true" /> Delete
            </Button>
          )}
        </div>
      </div>

      {data.blocked_by_open > 0 && (
        <p
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-fg"
        >
          Blocked by {data.blocked_by_open} unresolved{' '}
          {data.blocked_by_open === 1 ? 'issue' : 'issues'}. Resolve them before marking this done.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 flex min-w-0 flex-col gap-7 lg:order-1">
          <TaskDescription
            key={`d-${data.updated_at}`}
            value={data.description}
            editable={editable}
            onSave={(description) => save({ description })}
          />
          {(data.issue_type === 'bug' || data.issue_type === 'incident') && (
            <TaskDescription
              key={`e-${data.updated_at}`}
              title="Environment"
              rich={false}
              emptyText="No environment recorded."
              value={data.environment}
              editable={editable}
              onSave={(environment) => save({ environment })}
            />
          )}
          {isEpic && <ChildIssues epic={data} project={proj} canCreate={canLog} />}
          {!isEpic && data.parent_id === null && (
            <SubtaskSection task={data} project={proj} canCreate={canLog} />
          )}
          <ChecklistSection task={data} projectId={proj.id} editable={editable} />
          <IssueLinks taskId={data.id} projectId={proj.id} canEdit={canLog} />
          <AttachmentsSection
            taskId={data.id}
            projectId={proj.id}
            canUpload={canLog}
            canManage={(file) => manageAny || file.uploaded_by?.id === userId}
          />
          <IssueActivity
            taskId={data.id}
            projectId={proj.id}
            role={role}
            canManageWorklog={(log) => canLog && (manageAny || log.author?.id === userId)}
          />
        </div>

        <aside
          aria-label="Issue details"
          className={cn('order-1 flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2')}
        >
          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold">Details</h4>
            <IssueDetails
              task={data}
              project={proj}
              editable={editable}
              canPlan={can(role, 'sprint:manage')}
              onChange={save}
            />
            <TimeTracking
              task={data}
              projectId={proj.id}
              editable={editable}
              canLog={canLog}
              onChange={(changes) => save(changes)}
            />
          </Card>
          {data.watchers.length > 0 && (
            <Card className="p-4">
              <h4 className="mb-2 text-sm font-semibold">Watchers</h4>
              <ul className="flex flex-wrap gap-2">
                {data.watchers.map((watcher) => (
                  <li key={watcher.id}>
                    <Avatar name={watcher.name} color={watcher.avatar_color} size="sm" />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Link
            to={routes.board(proj.id)}
            className="inline-flex items-center gap-1 text-sm text-primary-text hover:underline"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Back to board
          </Link>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete issue?"
        description={`“${data.key} ${data.title}” and its subtasks, comments and work logs will be permanently deleted.`}
        confirmLabel="Delete issue"
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              toast.success('Issue deleted')
              navigate(routes.board(proj.id), { replace: true })
            },
          })
        }
      />
    </div>
  )
}
