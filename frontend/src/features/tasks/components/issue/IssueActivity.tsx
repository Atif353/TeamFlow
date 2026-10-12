import { useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { CommentThread } from '@/features/comments'
import type { Role } from '@/types/common'
import type { Worklog } from '../../types'
import { HistoryList } from './HistoryList'
import { WorklogList } from './WorklogList'

type ActivityTab = 'comments' | 'history' | 'worklog'

interface IssueActivityProps {
  taskId: string
  projectId: string
  role: Role
  canManageWorklog: (worklog: Worklog) => boolean
}

export function IssueActivity({ taskId, projectId, role, canManageWorklog }: IssueActivityProps) {
  const [tab, setTab] = useState<ActivityTab>('comments')
  return (
    <section aria-label="Activity" className="flex flex-col gap-4">
      <h4 className="text-sm font-semibold">Activity</h4>
      <Tabs
        ariaLabel="Activity sections"
        value={tab}
        onChange={(value) => setTab(value as ActivityTab)}
        items={[
          { value: 'comments', label: 'Comments' },
          { value: 'history', label: 'History' },
          { value: 'worklog', label: 'Work log' },
        ]}
      />
      {tab === 'comments' && (
        <CommentThread taskId={taskId} projectId={projectId} projectRole={role} />
      )}
      {tab === 'history' && <HistoryList taskId={taskId} />}
      {tab === 'worklog' && (
        <WorklogList taskId={taskId} projectId={projectId} canManage={canManageWorklog} />
      )}
    </section>
  )
}
