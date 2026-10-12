import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { greeting } from '@/lib/formatters'
import { useAuthStore } from '@/store/authStore'
import { MyWork } from '../components/MyWork'
import { WorkspaceDashboard } from '../components/WorkspaceDashboard'

type View = 'workspace' | 'mine'

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const role = useAuthStore((state) => state.role)
  const [view, setView] = useState<View>('workspace')
  const firstName = user?.name.split(' ')[0] ?? ''
  const isAdmin = role === 'super_admin'

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          isAdmin && view === 'workspace'
            ? 'How your whole workspace is doing.'
            : 'Here is what needs your attention.'
        }
      />
      {isAdmin && (
        <Tabs
          ariaLabel="Dashboard view"
          value={view}
          onChange={(value) => setView(value as View)}
          className="mb-6"
          items={[
            { value: 'workspace', label: 'Workspace' },
            { value: 'mine', label: 'My work' },
          ]}
        />
      )}
      {isAdmin && view === 'workspace' ? <WorkspaceDashboard /> : <MyWork />}
    </>
  )
}
