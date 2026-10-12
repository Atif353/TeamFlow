import { ScrollText } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, formatRelative } from '@/lib/formatters'
import { useAuditActions, useAuditLogs } from '../hooks/useAdmin'
import type { AuditEntry } from '../types'

const PAGE_SIZE = 20

function labelOf(action: string): string {
  return action.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())
}

const columns: Column<AuditEntry>[] = [
  {
    key: 'when',
    header: 'When',
    render: (entry) => (
      <span title={formatDate(entry.created_at)}>{formatRelative(entry.created_at)}</span>
    ),
  },
  {
    key: 'actor',
    header: 'Actor',
    render: (entry) =>
      entry.actor ? (
        <span className="inline-flex items-center gap-2">
          <Avatar name={entry.actor.name} color={entry.actor.avatar_color} size="sm" />
          {entry.actor.name}
        </span>
      ) : (
        'Unknown'
      ),
  },
  { key: 'action', header: 'Action', render: (entry) => <Badge>{labelOf(entry.action)}</Badge> },
  { key: 'summary', header: 'Details', render: (entry) => entry.summary },
]

export function AdminAuditPage() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim(), 300)
  const actions = useAuditActions()
  const logs = useAuditLogs({
    page,
    page_size: PAGE_SIZE,
    q: q || undefined,
    action: action || undefined,
  })

  return (
    <>
      <PageHeader
        title="Audit log"
        description="A record of role changes, deactivations, removals and project deletions."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search details"
          ariaLabel="Search audit log"
          className="sm:col-span-2 lg:w-72"
        />
        <Select
          aria-label="Filter by action"
          value={action}
          onChange={(event) => {
            setAction(event.target.value)
            setPage(1)
          }}
          placeholder="All actions"
          options={(actions.data ?? []).map((item) => ({ value: item, label: labelOf(item) }))}
          className="lg:w-56"
        />
      </div>
      {logs.isError ? (
        <ErrorState onRetry={() => void logs.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Audit log"
            columns={columns}
            rows={logs.data?.items ?? []}
            rowKey={(entry) => entry.id}
            loading={logs.isPending}
            empty={<EmptyState icon={ScrollText} title="No audit entries match your filters" />}
          />
          {logs.data && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={logs.data.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </>
  )
}
