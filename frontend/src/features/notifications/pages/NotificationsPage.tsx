import { BellOff } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'
import { NotificationItem } from '../components/NotificationItem'
import { useMarkAllRead, useNotifications, useUnreadCount } from '../hooks/useNotifications'
import { useOpenNotification } from '../hooks/useOpenNotification'

const PAGE_SIZE = 20

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const unread = useUnreadCount()
  const list = useNotifications({ page, page_size: PAGE_SIZE, unread_only: filter === 'unread' })
  const markAll = useMarkAllRead()
  const open = useOpenNotification()

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about work assigned to you."
        actions={
          <Button
            variant="outline"
            disabled={(unread.data ?? 0) === 0}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        }
      />
      <Tabs
        ariaLabel="Notification filter"
        value={filter}
        onChange={(value) => {
          setFilter(value as 'all' | 'unread')
          setPage(1)
        }}
        items={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: `Unread${unread.data ? ` (${unread.data})` : ''}` },
        ]}
        className="mb-4"
      />
      {list.isPending ? (
        <SkeletonList rows={5} />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="When someone assigns you a task, you'll see it here."
        />
      ) : (
        <>
          <Card className="p-1">
            <ul>
              {list.data.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onSelect={open}
                />
              ))}
            </ul>
          </Card>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  )
}
