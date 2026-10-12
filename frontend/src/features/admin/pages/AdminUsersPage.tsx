import { UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { RoleBadge } from '@/components/common/RoleBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { ROLES, ROLE_LABELS } from '@/config/roles'
import { useDebounce } from '@/hooks/useDebounce'
import { formatRelative } from '@/lib/formatters'
import type { Role } from '@/types/common'
import { CreateUserModal } from '../components/CreateUserModal'
import { UserDrawer } from '../components/UserDrawer'
import { useAdminStats, useAdminUsers } from '../hooks/useAdmin'
import type { AdminUser } from '../types'

const PAGE_SIZE = 10

const columns: Column<AdminUser>[] = [
  {
    key: 'user',
    header: 'User',
    render: (user) => (
      <div className="flex items-center gap-3">
        <Avatar name={user.name} color={user.avatar_color} inactive={!user.is_active} />
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
    ),
  },
  { key: 'role', header: 'Role', render: (user) => <RoleBadge role={user.role} /> },
  {
    key: 'status',
    header: 'Status',
    render: (user) => (
      <Badge tone={user.is_active ? 'success' : 'danger'}>
        {user.is_active ? 'Active' : 'Deactivated'}
      </Badge>
    ),
  },
  { key: 'login', header: 'Last login', render: (user) => formatRelative(user.last_login_at) },
  { key: 'projects', header: 'Projects', render: (user) => user.project_count },
]

export function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const q = useDebounce(search.trim(), 300)
  const stats = useAdminStats()
  const users = useAdminUsers({
    page,
    page_size: PAGE_SIZE,
    q: q || undefined,
    role: (role || undefined) as Role | undefined,
    is_active: status === '' ? undefined : status === 'active',
  })
  const reset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value)
      setPage(1)
    }

  return (
    <>
      <PageHeader
        title="Users"
        description={
          stats.data
            ? `${stats.data.total_users} users · ${stats.data.active_users} active · ${stats.data.pending_invitations} pending invitations`
            : 'Create users and manage their roles, project access and account status.'
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus size={16} aria-hidden="true" /> Create user
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
        <SearchInput
          value={search}
          onChange={reset(setSearch)}
          placeholder="Search by name or email"
          ariaLabel="Search users"
          className="sm:col-span-2 lg:w-72"
        />
        <Select
          aria-label="Filter by role"
          value={role}
          onChange={(event) => reset(setRole)(event.target.value)}
          placeholder="All roles"
          options={ROLES.map((item) => ({ value: item, label: ROLE_LABELS[item] }))}
          className="lg:w-48"
        />
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => reset(setStatus)(event.target.value)}
          placeholder="Any status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Deactivated' },
          ]}
          className="lg:w-44"
        />
      </div>
      {users.isError ? (
        <ErrorState onRetry={() => void users.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Workspace users"
            columns={columns}
            rows={users.data?.items ?? []}
            rowKey={(user) => user.id}
            loading={users.isPending}
            onRowClick={(user) => setSelected(user.id)}
            rowLabel={(user) => `Manage ${user.name}`}
            empty={<EmptyState icon={Users} title="No users match your filters" />}
          />
          {users.data && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={users.data.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
      <UserDrawer userId={selected} onClose={() => setSelected(null)} />
      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={setSelected} />
    </>
  )
}
