import { UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { RoleBadge } from '@/components/common/RoleBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ROLES, ROLE_LABELS } from '@/config/roles'
import { formatRelative } from '@/lib/formatters'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types/common'
import { useAdminUser, useUserAdminActions } from '../hooks/useAdmin'
import { EditUserSection } from './EditUserSection'
import { ProjectAccessList } from './ProjectAccessList'

interface UserDrawerProps {
  userId: string | null
  onClose: () => void
}

function DrawerBody({ userId }: { userId: string }) {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const detail = useAdminUser(userId)
  const actions = useUserAdminActions(userId)
  const [confirming, setConfirming] = useState(false)

  if (detail.isPending) return <SkeletonList rows={4} className="p-4" />
  if (detail.isError) return <ErrorState onRetry={() => void detail.refetch()} />

  const user = detail.data
  const isSelf = user.id === currentUserId
  const toggleStatus = () =>
    actions.changeStatus.mutate(!user.is_active, {
      onSuccess: () => {
        toast.success(user.is_active ? `${user.name} deactivated` : `${user.name} reactivated`)
        setConfirming(false)
      },
      onError: () => setConfirming(false),
    })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-5">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} color={user.avatar_color} size="lg" inactive={!user.is_active} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <RoleBadge role={user.role} />
            <Badge tone={user.is_active ? 'success' : 'danger'}>
              {user.is_active ? 'Active' : 'Deactivated'}
            </Badge>
            Last login {formatRelative(user.last_login_at)}
          </p>
        </div>
      </div>
      <Select
        label="Workspace role"
        value={user.role}
        disabled={actions.changeRole.isPending}
        options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
        onChange={(event) =>
          actions.changeRole.mutate(event.target.value as Role, {
            onSuccess: () => toast.success('Role updated'),
          })
        }
      />
      <EditUserSection key={`${user.name}-${user.email}`} user={user} />
      <section aria-labelledby="access-heading" className="flex flex-col gap-2">
        <h3 id="access-heading" className="text-sm font-semibold">
          Project access
        </h3>
        <p className="text-xs text-muted-foreground">
          Add the user to projects and optionally override their role inside a single project.
        </p>
        <ProjectAccessList user={user} />
      </section>
      <section
        aria-labelledby="account-heading"
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <h3 id="account-heading" className="text-sm font-semibold">
          Account
        </h3>
        <div>
          <Button
            variant={user.is_active ? 'danger' : 'primary'}
            disabled={isSelf}
            onClick={() => (user.is_active ? setConfirming(true) : toggleStatus())}
            loading={!confirming && actions.changeStatus.isPending}
          >
            {user.is_active ? (
              <>
                <UserX size={16} aria-hidden="true" /> Deactivate user
              </>
            ) : (
              <>
                <UserCheck size={16} aria-hidden="true" /> Reactivate user
              </>
            )}
          </Button>
          {isSelf && (
            <p className="mt-2 text-xs text-muted-foreground">
              You cannot deactivate your own account.
            </p>
          )}
        </div>
      </section>
      <ConfirmDialog
        open={confirming}
        title="Deactivate user?"
        description={`${user.name} will be signed out immediately and cannot log in. Their tasks and comments are kept.`}
        confirmLabel="Deactivate"
        loading={actions.changeStatus.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={toggleStatus}
      />
    </div>
  )
}

export function UserDrawer({ userId, onClose }: UserDrawerProps) {
  return (
    <Drawer open={userId !== null} onClose={onClose} title="Manage user">
      {userId && <DrawerBody key={userId} userId={userId} />}
    </Drawer>
  )
}
