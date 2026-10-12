import { FolderKanban } from 'lucide-react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/routes'
import { useProject } from '@/features/projects'
import { toApiError } from '@/lib/axios'
import { ProjectNav } from './ProjectNav'
import { sectionsFor } from './projectSections'

export function ProjectLayout() {
  const { projectId = '' } = useParams()
  const project = useProject(projectId)

  if (project.isPending) {
    return (
      <div role="status" aria-label="Loading project" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (project.isError) {
    const notFound = toApiError(project.error).code === 'project_not_found'
    return notFound ? (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="This project does not exist or you do not have access to it."
        action={
          <Link to={routes.projects} className={buttonVariants({ variant: 'outline' })}>
            Back to projects
          </Link>
        }
      />
    ) : (
      <ErrorState onRetry={() => void project.refetch()} />
    )
  }

  const data = project.data
  const sections = sectionsFor(data.my_role)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{
            backgroundColor: data.color,
            backgroundImage: 'linear-gradient(rgb(0 0 0 / 0.18), rgb(0 0 0 / 0.18))',
          }}
          aria-hidden="true"
        >
          {data.key.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{data.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {data.key}
            {data.description ? ` · ${data.description}` : ''}
          </p>
        </div>
      </header>
      <ProjectNav projectId={data.id} sections={sections} />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
