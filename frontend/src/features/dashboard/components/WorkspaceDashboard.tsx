import { AlertTriangle, CheckCircle2, Clock, Layers, Rocket } from 'lucide-react'
import { BarsChart } from '@/components/charts/BarsChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { BreakdownBar } from '@/components/charts/BreakdownBar'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { StatCard, StatGroup } from '@/components/common/StatCard'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAnalytics } from '@/features/admin/hooks/useAdmin'
import { formatDuration } from '@/lib/duration'
import { TeamTable } from './TeamTable'

export function WorkspaceDashboard() {
  const analytics = useAnalytics()
  if (analytics.isError) return <ErrorState onRetry={() => void analytics.refetch()} />
  const data = analytics.data
  const loading = analytics.isPending
  const noIssues = (data?.type_counts.length ?? 0) === 0

  return (
    <div className="flex flex-col gap-6">
      <StatGroup>
        <StatCard label="Open issues" value={data?.total_open} icon={Layers} loading={loading} />
        <StatCard
          label="Overdue"
          tone="danger"
          value={data?.total_overdue}
          icon={AlertTriangle}
          loading={loading}
        />
        <StatCard
          label="Completed, last 30 days"
          tone="success"
          value={data?.total_completed_30_days}
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard
          label="Time logged, last 30 days"
          tone="info"
          value={formatDuration(data?.total_minutes_logged ?? 0)}
          icon={Clock}
          loading={loading}
        />
        <StatCard
          label="Active sprints"
          tone="warning"
          value={data?.active_sprints}
          icon={Rocket}
          loading={loading}
        />
      </StatGroup>

      <div className="grid gap-6 lg:grid-cols-3">
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
          subtitle="Whole workspace, last 30 days"
          className="lg:col-span-2"
          loading={loading}
          empty={noIssues}
          emptyMessage="No issues yet"
          height={260}
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
          title="Issues by type"
          loading={loading}
          empty={noIssues}
          emptyMessage="No issues yet"
        >
          <BreakdownBar items={data?.type_counts ?? []} />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Issues per project"
          subtitle="Done and still open"
          className="lg:col-span-2"
          loading={loading}
          empty={(data?.projects.length ?? 0) === 0}
          emptyMessage="No projects yet"
          height={240}
        >
          <BarsChart
            layout="vertical"
            stacked
            data={(data?.projects ?? []).map((project) => ({
              name: project.key,
              done: project.done,
              open: project.total - project.done,
            }))}
            xKey="name"
            series={[
              { key: 'done', label: 'Done', color: 'var(--series-3)' },
              { key: 'open', label: 'Open', color: 'var(--series-1)' },
            ]}
          />
        </ChartCard>
        <ChartCard
          auto
          title="Open by priority"
          loading={loading}
          empty={noIssues}
          emptyMessage="No issues yet"
        >
          <BreakdownBar items={data?.priority_counts ?? []} />
        </ChartCard>
      </div>

      {data && <TeamTable rows={data.team} />}
    </div>
  )
}
