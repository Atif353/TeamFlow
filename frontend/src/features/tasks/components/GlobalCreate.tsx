import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { can } from '@/config/roles'
import { useProject, useProjects } from '@/features/projects'
import { usePermission } from '@/hooks/usePermission'
import { TaskCreateModal } from './TaskCreateModal'

function ProjectChooser({
  open,
  onClose,
  onChoose,
}: {
  open: boolean
  onClose: () => void
  onChoose: (projectId: string) => void
}) {
  const projects = useProjects({ page_size: 100 })
  const writable = (projects.data?.items ?? []).filter((project) =>
    can(project.my_role, 'task:create'),
  )
  const [selected, setSelected] = useState('')
  const current = selected || writable[0]?.id || ''

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (current) onChoose(current)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create issue"
      description="Choose the project this issue belongs to."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="choose-project-form" disabled={!current}>
            Continue
          </Button>
        </>
      }
    >
      <form id="choose-project-form" onSubmit={submit}>
        {writable.length === 0 && !projects.isPending ? (
          <p className="text-sm text-muted-foreground">
            You are not a member of any project where you can create issues.
          </p>
        ) : (
          <Select
            label="Project"
            value={current}
            data-autofocus
            onChange={(event) => setSelected(event.target.value)}
            options={writable.map((project) => ({
              value: project.id,
              label: `${project.name} (${project.key})`,
            }))}
          />
        )}
      </form>
    </Modal>
  )
}

function CreateForProject({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const project = useProject(projectId)
  if (!project.data) return null
  return <TaskCreateModal open onClose={onClose} project={project.data} />
}

export function GlobalCreate({ compact }: { compact: boolean }) {
  const [choosing, setChoosing] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const allowed = usePermission('task:create')
  if (!allowed) return null
  return (
    <>
      {compact ? (
        <IconButton icon={Plus} label="Create issue" onClick={() => setChoosing(true)} />
      ) : (
        <Button onClick={() => setChoosing(true)}>
          <Plus size={16} aria-hidden="true" /> Create
        </Button>
      )}
      <ProjectChooser
        open={choosing}
        onClose={() => setChoosing(false)}
        onChoose={(id) => {
          setChoosing(false)
          setProjectId(id)
        }}
      />
      {projectId && <CreateForProject projectId={projectId} onClose={() => setProjectId(null)} />}
    </>
  )
}
