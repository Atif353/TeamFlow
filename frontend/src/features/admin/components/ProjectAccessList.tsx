import { FolderKanban } from 'lucide-react'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { OVERRIDE_ROLES, ROLE_LABELS } from '@/config/roles'
import { useProjects } from '@/features/projects'
import type { Role } from '@/types/common'
import { useUserAdminActions } from '../hooks/useAdmin'
import type { AdminUserDetail } from '../types'

export function ProjectAccessList({ user }: { user: AdminUserDetail }) {
  const projects = useProjects({ page_size: 100 })
  const actions = useUserAdminActions(user.id)
  const memberships = new Map(user.projects.map((project) => [project.project_id, project]))
  const isSuperAdmin = user.role === 'super_admin'

  if (projects.isPending) return <Skeleton className="h-24" />
  if (!projects.data || projects.data.items.length === 0) {
    return <EmptyState icon={FolderKanban} title="No projects in this workspace" />
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {projects.data.items.map((project) => {
        const membership = memberships.get(project.id)
        return (
          <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <Checkbox
              label={`${project.name} (${project.key})`}
              checked={Boolean(membership) || isSuperAdmin}
              disabled={
                isSuperAdmin || actions.setOverride.isPending || actions.removeFromProject.isPending
              }
              onChange={(event) =>
                event.target.checked
                  ? actions.setOverride.mutate({ projectId: project.id, role: null })
                  : actions.removeFromProject.mutate(project.id)
              }
            />
            {membership && !isSuperAdmin && (
              <Select
                aria-label={`Role in ${project.name}`}
                value={membership.role_override ?? ''}
                disabled={actions.setOverride.isPending}
                onChange={(event) =>
                  actions.setOverride.mutate({
                    projectId: project.id,
                    role: (event.target.value || null) as Role | null,
                  })
                }
                placeholder={`Workspace role (${ROLE_LABELS[user.role]})`}
                options={OVERRIDE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                className="w-full sm:w-56"
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
