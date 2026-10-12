import { FolderKanban, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePermission } from '@/hooks/usePermission'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { useDeleteProject, useProjects } from '../hooks/useProjects'
import type { Project } from '../types'

const PAGE_SIZE = 12

export function ProjectsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Project | undefined>()
  const [deleting, setDeleting] = useState<Project | null>(null)
  const canCreate = usePermission('project:create')
  const q = useDebounce(search.trim(), 300)
  const { data, isPending, isError, refetch } = useProjects({
    page,
    page_size: PAGE_SIZE,
    q: q || undefined,
  })
  const remove = useDeleteProject()

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const confirmDelete = () => {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Project deleted')
        setDeleting(null)
      },
    })
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Everything your team is working on."
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus size={16} aria-hidden="true" /> New project
            </Button>
          )
        }
      />
      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        placeholder="Search projects"
        ariaLabel="Search projects"
        className="mb-4 max-w-sm"
      />
      {isPending ? (
        <div
          role="status"
          aria-label="Loading projects"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-52" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={q ? 'No projects match your search' : 'No projects yet'}
          description={
            q
              ? 'Try a different name or key.'
              : canCreate
                ? 'Create your first project to start planning work.'
                : 'You have not been added to any project yet. Ask a project manager to add you.'
          }
          action={
            canCreate && !q ? (
              <Button onClick={openCreate}>
                <Plus size={16} aria-hidden="true" /> New project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                onEdit={(item) => {
                  setEditing(item)
                  setFormOpen(true)
                }}
                onDelete={setDeleting}
              />
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}
      <ProjectFormModal open={formOpen} onClose={() => setFormOpen(false)} project={editing} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete project?"
        description={`“${deleting?.name ?? ''}” and all of its tasks, comments and labels will be permanently deleted.`}
        confirmLabel="Delete project"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}
