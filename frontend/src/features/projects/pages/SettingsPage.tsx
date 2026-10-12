import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { can } from '@/config/roles'
import { routes } from '@/config/routes'
import { usePermission } from '@/hooks/usePermission'
import { AutomationManager } from '../components/AutomationManager'
import { ComponentsManager } from '../components/ComponentsManager'
import { LabelManager } from '../components/LabelManager'
import { ReleasesManager } from '../components/ReleasesManager'
import { ProjectDetailsForm } from '../components/ProjectDetailsForm'
import { StatusEditor } from '../components/StatusEditor'
import { WorkflowEditor } from '../components/WorkflowEditor'
import { useDeleteProject, useProject } from '../hooks/useProjects'

export function SettingsPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const project = useProject(projectId)
  const remove = useDeleteProject()
  const canDelete = usePermission('project:delete', project.data?.my_role)
  const [confirming, setConfirming] = useState(false)

  if (project.isPending) return <Skeleton className="h-64" />
  if (project.isError) return <ErrorState onRetry={() => void project.refetch()} />
  if (!can(project.data.my_role, 'project:members'))
    return <Navigate to={routes.forbidden} replace />

  const data = project.data
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Details</h2>
        </CardHeader>
        <CardBody>
          <ProjectDetailsForm project={data} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Labels</h2>
        </CardHeader>
        <CardBody>
          <LabelManager projectId={data.id} />
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <h2 className="text-base font-semibold">Statuses</h2>
            <p className="text-sm text-muted-foreground">
              Columns on your board. A status with tasks cannot be deleted until its tasks are
              moved.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <StatusEditor key={data.updated_at} project={data} />
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <h2 className="text-base font-semibold">Workflow</h2>
            <p className="text-sm text-muted-foreground">
              Control which status changes are allowed. Statuses without limits allow any move.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <WorkflowEditor key={data.updated_at} project={data} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Components</h2>
        </CardHeader>
        <CardBody>
          <ComponentsManager project={data} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Releases</h2>
        </CardHeader>
        <CardBody>
          <ReleasesManager projectId={data.id} />
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <h2 className="text-base font-semibold">Automation</h2>
            <p className="text-sm text-muted-foreground">
              Rules run automatically when issues change. Overdue issues also notify their assignee
              once.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <AutomationManager project={data} />
        </CardBody>
      </Card>
      {canDelete && (
        <Card className="border-danger/40 lg:col-span-2">
          <CardHeader>
            <div>
              <h2 className="text-base font-semibold text-danger-fg">Danger zone</h2>
              <p className="text-sm text-muted-foreground">
                Deleting a project removes its tasks, comments, labels and memberships.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete project
            </Button>
          </CardHeader>
        </Card>
      )}
      <ConfirmDialog
        open={confirming}
        title="Delete project?"
        description={`“${data.name}” and everything in it will be permanently deleted.`}
        confirmLabel="Delete project"
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              toast.success('Project deleted')
              navigate(routes.projects, { replace: true })
            },
          })
        }
      />
    </div>
  )
}
