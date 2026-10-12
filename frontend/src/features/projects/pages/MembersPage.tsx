import { UserMinus, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { RoleBadge } from '@/components/common/RoleBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { usePermission } from '@/hooks/usePermission'
import { AddMemberModal } from '../components/AddMemberModal'
import { useProject, useProjectMembers, useRemoveProjectMember } from '../hooks/useProjects'
import type { ProjectMember } from '../types'

export function MembersPage() {
  const { projectId = '' } = useParams()
  const project = useProject(projectId)
  const members = useProjectMembers(projectId)
  const remove = useRemoveProjectMember(projectId)
  const canManage = usePermission('project:members', project.data?.my_role)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<ProjectMember | null>(null)

  const columns: Column<ProjectMember>[] = [
    {
      key: 'name',
      header: 'Member',
      render: (member) => (
        <div className="flex items-center gap-3">
          <Avatar name={member.name} color={member.avatar_color} inactive={!member.is_active} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {member.name} {!member.is_active && <Badge tone="danger">Deactivated</Badge>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role in project',
      render: (member) => (
        <span className="inline-flex items-center gap-2">
          <RoleBadge role={member.effective_role} />
          {member.role_override && <Badge tone="warning">Override</Badge>}
        </span>
      ),
    },
  ]
  if (canManage) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      className: 'w-24 text-right',
      render: (member) => (
        <IconButton
          icon={UserMinus}
          label={`Remove ${member.name}`}
          onClick={() => setRemoving(member)}
        />
      ),
    })
  }

  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="members-heading" className="text-lg font-semibold">
          Members{' '}
          {members.data && <span className="text-muted-foreground">({members.data.total})</span>}
        </h2>
        {canManage && (
          <Button onClick={() => setAdding(true)}>
            <UserPlus size={16} aria-hidden="true" /> Add member
          </Button>
        )}
      </div>
      {members.isError ? (
        <ErrorState onRetry={() => void members.refetch()} />
      ) : (
        <DataTable
          caption="Project members"
          columns={columns}
          rows={members.data?.items ?? []}
          rowKey={(member) => member.user_id}
          loading={members.isPending}
          empty={<EmptyState icon={Users} title="No members yet" />}
        />
      )}
      <AddMemberModal
        open={adding}
        onClose={() => setAdding(false)}
        projectId={projectId}
        existing={members.data?.items ?? []}
      />
      <ConfirmDialog
        open={removing !== null}
        title="Remove member?"
        description={`${removing?.name ?? ''} will lose access to this project. Their assigned tasks will become unassigned.`}
        confirmLabel="Remove"
        loading={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.user_id, {
            onSuccess: () => {
              toast.success(`${removing.name} removed`)
              setRemoving(null)
            },
          })
        }
      />
    </section>
  )
}
