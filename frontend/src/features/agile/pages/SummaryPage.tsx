import { AlertTriangle, CheckCircle2, Clock, FilePlus2, UserX } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { BarsChart } from '@/components/charts/BarsChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { BreakdownBar } from '@/components/charts/BreakdownBar'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { StatCard, StatGroup } from '@/components/common/StatCard'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDuration } from '@/lib/duration'
import { ActiveSprintCard } from '../components/ActiveSprintCard'
import { ActivityFeed } from '../components/ActivityFeed'
import { EpicProgressList } from '../components/EpicProgressList'
import { useSummary } from '../hooks/useAgile'

export function SummaryPage() {
  const { projectId = '' } = useParams()
  const summary = useSummary(projectId)

  if (summary.isError) return <ErrorState onRetry={() => void summary.refetch()} />
  const data = summary.data
  const loading = summary.isPending

  return (
    <section aria-label="Project summary" className="flex flex-col gap-5">
      <StatGroup>
        <StatCard
          label="Completed in 7 days"
          tone="success"
          value={data?.resolved_last_7_days}
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard
          label="Created in 7 days"
          tone="info"
          value={data?.created_last_7_days}
          icon={FilePlus2}
          loading={loading}
        />
        <StatCard
          label="Due in 7 days"
          tone="warning"
          value={data?.due_soon}
          icon={Clock}
          loading={loading}
        />
        <StatCard
          label="Overdue"
          tone="danger"
          value={data?.overdue}
          icon={AlertTriangle}
          loading={loading}
        />
        <StatCard label="Unassigned" value={data?.unassigned} icon={UserX} loading={loading} />
      </StatGroup>

      {data?.active_sprint && (
        <ActiveSprintCard
          projectId={projectId}
          sprint={data.active_sprint.sprint}
          daysRemaining={data.active_sprint.days_remaining}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          auto
          title="Status overview"
          subtitle="Issues by workflow status"
          loading={loading}
          empty={data?.total === 0}
        >
          <BreakdownBar items={data?.status_counts ?? []} />
        </ChartCard>
        <ChartCard
          title="Created vs resolved"
          table={{
            headers: ['Date', 'Created', 'Resolved'],
            rows: (data?.created_vs_resolved ?? []).map((row) => [
              row.date,
              row.created,
              row.resolved,
            ]),
          }}
          subtitle="Last 14 days"
          loading={loading}
          empty={data?.total === 0}
        >
          <TimeSeriesChart
            variant="area"
            data={data?.created_vs_resolved ?? []}
            series={[
              { key: 'created', label: 'Created', color: 'var(--series-2)' },
              { key: 'resolved', label: 'Resolved', color: 'var(--series-3)' },
            ]}
          />
        </ChartCard>
        <ChartCard
          auto
          title="Types of work"
          subtitle="All issues by type"
          loading={loading}
          empty={(data?.type_counts.length ?? 0) === 0}
        >
          <BreakdownBar items={data?.type_counts ?? []} />
        </ChartCard>
        <ChartCard
          title="Open issues by priority"
          loading={loading}
          empty={data?.open === 0}
          emptyMessage="No open issues"
        >
          <BarsChart
            layout="vertical"
            data={(data?.priority_counts ?? []).map((item) => ({ ...item }))}
            xKey="name"
            series={[{ key: 'count', label: 'Issues', color: 'var(--series-1)' }]}
          />
        </ChartCard>
        <ChartCard
          title="Team workload"
          subtitle="Open issues per assignee"
          loading={loading}
          empty={(data?.assignee_counts.length ?? 0) === 0}
          emptyMessage="No open issues"
        >
          <BarsChart
            layout="vertical"
            data={(data?.assignee_counts ?? []).map((row) => ({
              name: row.user?.name ?? 'Unassigned',
              count: row.count,
            }))}
            xKey="name"
            series={[{ key: 'count', label: 'Open issues', color: 'var(--series-1)' }]}
          />
        </ChartCard>
        <div className="flex flex-col gap-5">
          <EpicProgressList epics={data?.epics ?? []} />
          {data && (
            <div className="rounded-xl border border-border bg-surface p-4 text-sm md:p-5">
              <h3 className="mb-2 text-sm font-semibold">Time tracking</h3>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dd className="text-lg font-semibold">{formatDuration(data.estimate_minutes)}</dd>
                  <dt className="text-xs text-muted-foreground">Estimated</dt>
                </div>
                <div>
                  <dd className="text-lg font-semibold">{formatDuration(data.spent_minutes)}</dd>
                  <dt className="text-xs text-muted-foreground">Logged</dt>
                </div>
                <div>
                  <dd className="text-lg font-semibold">
                    {formatDuration(data.remaining_minutes)}
                  </dd>
                  <dt className="text-xs text-muted-foreground">Remaining</dt>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
      <ActivityFeed rows={data?.recent_activity ?? []} />
    </section>
  )
}
