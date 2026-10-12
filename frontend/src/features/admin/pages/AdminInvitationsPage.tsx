import { MailPlus, RefreshCw, Send, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { RoleBadge } from '@/components/common/RoleBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { Tabs } from '@/components/ui/Tabs'
import { formatDate } from '@/lib/formatters'
import { CreateInvitationModal } from '../components/CreateInvitationModal'
import { InviteLinkModal } from '../components/InviteLinkModal'
import { useCreateInvitation, useInvitations, useRevokeInvitation } from '../hooks/useAdmin'
import type { Invitation, InvitationCreated, InvitationStatus } from '../types'

const PAGE_SIZE = 10
const STATUS_TONES = {
  pending: 'info',
  accepted: 'success',
  revoked: 'neutral',
  expired: 'warning',
} as const
const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
]

export function AdminInvitationsPage() {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<InvitationCreated | null>(null)
  const [revoking, setRevoking] = useState<Invitation | null>(null)
  const invitations = useInvitations({
    page,
    page_size: PAGE_SIZE,
    status: filter === 'all' ? undefined : (filter as InvitationStatus),
  })
  const resend = useCreateInvitation()
  const revoke = useRevokeInvitation()

  const columns: Column<Invitation>[] = [
    {
      key: 'email',
      header: 'Email',
      render: (item) => <span className="font-medium">{item.email}</span>,
    },
    { key: 'role', header: 'Role', render: (item) => <RoleBadge role={item.role} /> },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <Badge tone={STATUS_TONES[item.status]}>{item.status}</Badge>,
    },
    { key: 'invited', header: 'Invited by', render: (item) => item.invited_by?.name ?? '—' },
    { key: 'expires', header: 'Expires', render: (item) => formatDate(item.expires_at) },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (item) =>
        item.status === 'pending' || item.status === 'expired' ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-label={`Resend invitation to ${item.email}`}
              loading={resend.isPending && resend.variables?.email === item.email}
              onClick={() =>
                resend.mutate(
                  { email: item.email, role: item.role },
                  {
                    onSuccess: setCreated,
                    onError: () => toast.error('Could not resend the invitation'),
                  },
                )
              }
            >
              <RefreshCw size={14} aria-hidden="true" /> Resend
            </Button>
            {item.status === 'pending' && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Revoke invitation for ${item.email}`}
                onClick={() => setRevoking(item)}
              >
                <XCircle size={14} aria-hidden="true" /> Revoke
              </Button>
            )}
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Invitations"
        description="Invite people to join your workspace."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Send size={16} aria-hidden="true" /> Invite user
          </Button>
        }
      />
      <Tabs
        ariaLabel="Invitation status"
        items={TABS}
        value={filter}
        onChange={(value) => {
          setFilter(value)
          setPage(1)
        }}
        className="mb-4"
      />
      {invitations.isError ? (
        <ErrorState onRetry={() => void invitations.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Invitations"
            columns={columns}
            rows={invitations.data?.items ?? []}
            rowKey={(item) => item.id}
            loading={invitations.isPending}
            empty={
              <EmptyState
                icon={MailPlus}
                title="No invitations here"
                description="Invite teammates to start collaborating."
                action={<Button onClick={() => setCreating(true)}>Invite user</Button>}
              />
            }
          />
          {invitations.data && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={invitations.data.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
      <CreateInvitationModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={setCreated}
      />
      <InviteLinkModal invitation={created} onClose={() => setCreated(null)} />
      <ConfirmDialog
        open={revoking !== null}
        title="Revoke invitation?"
        description={`The link sent to ${revoking?.email ?? ''} will stop working.`}
        confirmLabel="Revoke"
        loading={revoke.isPending}
        onCancel={() => setRevoking(null)}
        onConfirm={() =>
          revoking &&
          revoke.mutate(revoking.id, {
            onSuccess: () => {
              toast.success('Invitation revoked')
              setRevoking(null)
            },
          })
        }
      />
    </>
  )
}
