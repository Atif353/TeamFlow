import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoleBadge } from '@/components/common/RoleBadge'
import { useWorkspaceMembers } from '@/features/workspace'
import { useAddProjectMember } from '../hooks/useProjects'
import type { ProjectMember } from '../types'

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  existing: ProjectMember[]
}

export function AddMemberModal({ open, onClose, projectId, existing }: AddMemberModalProps) {
  const [search, setSearch] = useState('')
  const workspaceMembers = useWorkspaceMembers(open)
  const add = useAddProjectMember(projectId)
  const taken = new Set(existing.map((member) => member.user_id))
  const needle = search.trim().toLowerCase()
  const candidates = (workspaceMembers.data?.items ?? []).filter(
    (member) =>
      member.is_active &&
      !taken.has(member.user_id) &&
      (member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle)),
  )

  return (
    <Modal open={open} onClose={onClose} title="Add project member" size="md">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search people"
        ariaLabel="Search people"
      />
      <div className="mt-4 max-h-80 overflow-y-auto">
        {workspaceMembers.isPending ? (
          <div role="status" aria-label="Loading people" className="flex flex-col gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Nobody left to add"
            description="Everyone in the workspace is already in this project, or no one matches your search."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {candidates.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-muted"
              >
                <Avatar name={member.name} color={member.avatar_color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <RoleBadge role={member.role} />
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Add ${member.name}`}
                  loading={add.isPending && add.variables?.userId === member.user_id}
                  onClick={() =>
                    add.mutate(
                      { userId: member.user_id },
                      { onSuccess: () => toast.success(`${member.name} added`) },
                    )
                  }
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
