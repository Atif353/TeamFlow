import { Download, Inbox, Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PriorityBadge } from '@/components/common/PriorityBadge'
import { RoleBadge } from '@/components/common/RoleBadge'
import { StatusPill } from '@/components/common/StatusPill'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DatePicker,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  Spinner,
  Tabs,
  Textarea,
  Tooltip,
} from '@/components/ui'

const PEOPLE = [
  { id: '1', name: 'Ada Lovelace', avatar_color: '#6366F1', is_active: true },
  { id: '2', name: 'Grace Hopper', avatar_color: '#10B981', is_active: true },
  { id: '3', name: 'Alan Turing', avatar_color: '#F59E0B', is_active: false },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="flex flex-wrap items-start gap-4">{children}</CardBody>
    </Card>
  )
}

export function UiShowcasePage() {
  const [modal, setModal] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [tab, setTab] = useState('one')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  return (
    <>
      <PageHeader
        title="UI showcase"
        description="Every shared component and state."
        actions={<ThemeToggle />}
      />
      <div className="grid gap-6">
        <Section title="Buttons">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <IconButton icon={Pencil} label="Edit" />
        </Section>
        <Section title="Form fields">
          <Input label="Text input" placeholder="Type here" className="w-64" />
          <Input label="With error" error="This field is required" className="w-64" />
          <Select
            label="Select"
            options={[
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ]}
            className="w-64"
          />
          <DatePicker label="Date" className="w-64" />
          <Textarea label="Textarea" className="w-64" />
          <Checkbox label="Checkbox" />
          <SearchInput value={search} onChange={setSearch} className="w-64" />
        </Section>
        <Section title="Badges and pills">
          <Badge>Neutral</Badge>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <RoleBadge role="super_admin" />
          <RoleBadge role="viewer" />
          <PriorityBadge priority="urgent" />
          <StatusPill name="In Progress" color="#6366F1" />
        </Section>
        <Section title="Avatars">
          <Avatar name="Ada Lovelace" color="#6366F1" size="lg" />
          <Avatar name="Alan Turing" color="#F59E0B" inactive />
          <AvatarGroup users={PEOPLE} total={7} />
        </Section>
        <Section title="Overlays">
          <Button variant="outline" onClick={() => setModal(true)}>
            Open modal
          </Button>
          <Button variant="outline" onClick={() => setDrawer(true)}>
            Open drawer
          </Button>
          <Button variant="outline" onClick={() => setConfirm(true)}>
            Confirm dialog
          </Button>
          <Tooltip content="A helpful tooltip">
            <Button variant="outline">Hover me</Button>
          </Tooltip>
          <Dropdown
            label="Example menu"
            trigger={<span className="px-3 py-2 text-sm">Menu</span>}
            triggerClassName="border border-border"
            items={[
              {
                key: 'download',
                label: 'Download',
                icon: Download,
                onSelect: () => toast.success('Download'),
              },
              {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                danger: true,
                onSelect: () => toast.error('Delete'),
              },
            ]}
          />
          <Button variant="outline" onClick={() => toast.success('Saved successfully')}>
            Show toast
          </Button>
        </Section>
        <Section title="Tabs">
          <Tabs
            ariaLabel="Example tabs"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'one', label: 'One' },
              { value: 'two', label: 'Two' },
              { value: 'three', label: 'Three' },
            ]}
            className="w-full"
          />
        </Section>
        <Section title="Loading, empty and error states">
          <Spinner />
          <Skeleton className="h-10 w-48" />
          <EmptyState
            icon={Inbox}
            title="Nothing here yet"
            description="Empty states explain what to do next."
            action={<Button>Primary action</Button>}
          />
          <ErrorState onRetry={() => toast.info('Retry')} />
        </Section>
        <Section title="Data table">
          <div className="w-full">
            <DataTable
              caption="Example table"
              rows={PEOPLE}
              rowKey={(row) => row.id}
              columns={[
                { key: 'name', header: 'Name', sortable: true, render: (row) => row.name },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (row.is_active ? 'Active' : 'Deactivated'),
                },
              ]}
              onSortChange={() => undefined}
              empty={<EmptyState icon={Inbox} title="No rows" />}
            />
            <Pagination page={page} pageSize={3} total={9} onPageChange={setPage} />
          </div>
        </Section>
      </div>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Example modal"
        footer={<Button onClick={() => setModal(false)}>Close</Button>}
      >
        <p className="text-sm text-muted-foreground">
          Press Escape or click the backdrop to close.
        </p>
      </Modal>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Example drawer">
        <p className="p-4 text-sm text-muted-foreground">
          Slides in from the right, or up from the bottom on phones.
        </p>
      </Drawer>
      <ConfirmDialog
        open={confirm}
        title="Are you sure?"
        description="This action cannot be undone."
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
