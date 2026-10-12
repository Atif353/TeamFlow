import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BarsChart } from '@/components/charts/BarsChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { routes } from '@/config/routes'
import { formatDuration, formatHours } from '@/lib/duration'
import { SprintReport } from '../components/SprintReport'
import {
  useBurndown,
  useCumulativeFlow,
  useSprints,
  useSummary,
  useTimeTracking,
  useVelocity,
  useWorkload,
} from '../hooks/useAgile'

type ReportTab = 'agile' | 'time' | 'team'
const TIME_WINDOWS = [7, 14, 30, 90]

function BurndownCard({ projectId }: { projectId: string }) {
  const sprints = useSprints(projectId, ['active', 'completed'])
  const [selected, setSelected] = useState('')
  const list = sprints.data ?? []
  const current =
    selected || list.find((sprint) => sprint.state === 'active')?.id || list.at(-1)?.id || ''
  const burndown = useBurndown(current || null)
  const unit = burndown.data?.unit ?? 'points'
  return (
    <ChartCard
      title="Sprint burndown"
      subtitle={`Remaining work in ${unit} against the ideal pace`}
      loading={sprints.isPending || (Boolean(current) && burndown.isPending)}
      empty={list.length === 0}
      emptyMessage="Start a sprint to see its burndown"
      height={280}
      actions={
        list.length > 0 && (
          <Select
            aria-label="Choose sprint"
            value={current}
            onChange={(event) => setSelected(event.target.value)}
            options={list.map((sprint) => ({ value: sprint.id, label: sprint.name }))}
            className="w-44"
          />
        )
      }
    >
      <TimeSeriesChart
        variant="line"
        data={burndown.data?.points ?? []}
        series={[
          { key: 'ideal', label: 'Ideal', color: 'var(--series-4)', dashed: true },
          { key: 'remaining', label: 'Remaining', color: 'var(--series-1)' },
        ]}
      />
    </ChartCard>
  )
}

function AgileReports({ projectId }: { projectId: string }) {
  const velocity = useVelocity(projectId)
  const flow = useCumulativeFlow(projectId)
  const summary = useSummary(projectId)
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <BurndownCard projectId={projectId} />
      </div>
      <div className="lg:col-span-2">
        <SprintReport projectId={projectId} />
      </div>
      <ChartCard
        title="Velocity"
        subtitle={
          velocity.data ? `Average ${velocity.data.average_points} points per sprint` : undefined
        }
        loading={velocity.isPending}
        empty={(velocity.data?.sprints.length ?? 0) === 0}
        emptyMessage="Complete a sprint to see velocity"
        height={280}
      >
        <BarsChart
          data={(velocity.data?.sprints ?? []).map((item) => ({ ...item }))}
          xKey="name"
          series={[
            { key: 'committed_points', label: 'Committed', color: 'var(--series-4)' },
            { key: 'completed_points', label: 'Completed', color: 'var(--series-3)' },
          ]}
        />
      </ChartCard>
      <ChartCard
        title="Cumulative flow"
        subtitle="Issues per status over 30 days"
        loading={flow.isPending}
        empty={(summary.data?.total ?? 1) === 0}
        height={280}
      >
        <TimeSeriesChart
          variant="stacked-area"
          data={(flow.data?.dates ?? []).map((date, index) => ({
            date,
            ...Object.fromEntries(
              (flow.data?.series ?? []).map((series) => [
                series.status_id,
                series.counts[index] ?? 0,
              ]),
            ),
          }))}
          series={(flow.data?.series ?? []).map((series) => ({
            key: series.status_id,
            label: series.name,
            color: series.color,
          }))}
        />
      </ChartCard>
      <ChartCard
        title="Created vs resolved"
        table={{
          headers: ['Date', 'Created', 'Resolved'],
          rows: (summary.data?.created_vs_resolved ?? []).map((row) => [
            row.date,
            row.created,
            row.resolved,
          ]),
        }}
        subtitle="Last 14 days"
        loading={summary.isPending}
        empty={(summary.data?.total ?? 1) === 0}
        height={280}
      >
        <TimeSeriesChart
          variant="area"
          data={summary.data?.created_vs_resolved ?? []}
          series={[
            { key: 'created', label: 'Created', color: 'var(--series-2)' },
            { key: 'resolved', label: 'Resolved', color: 'var(--series-3)' },
          ]}
        />
      </ChartCard>
    </div>
  )
}

function TimeReports({ projectId }: { projectId: string }) {
  const [days, setDays] = useState(30)
  const report = useTimeTracking(projectId, days)
  const data = report.data
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="grid flex-1 grid-cols-3 gap-3">
          {[
            ['Estimated', data?.estimate_minutes],
            ['Logged', data?.spent_minutes],
            ['Remaining', data?.remaining_minutes],
          ].map(([label, value]) => (
            <Card key={String(label)} className="p-4 text-center">
              <dd className="text-xl font-semibold">{formatDuration(Number(value ?? 0))}</dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </Card>
          ))}
        </dl>
        <Select
          aria-label="Time window"
          value={String(days)}
          onChange={(event) => setDays(Number(event.target.value))}
          options={TIME_WINDOWS.map((value) => ({
            value: String(value),
            label: `Last ${value} days`,
          }))}
          className="w-40"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Time logged per day"
          loading={report.isPending}
          empty={(data?.spent_minutes ?? 0) === 0}
          emptyMessage="No work logged yet"
        >
          <TimeSeriesChart
            variant="area"
            data={(data?.by_day ?? []).map((row) => ({ date: row.date, hours: row.minutes / 60 }))}
            series={[{ key: 'hours', label: 'Hours', color: 'var(--series-1)' }]}
            formatValue={(value) => `${Number(value.toFixed(1))}h`}
          />
        </ChartCard>
        <ChartCard
          title="Time logged per person"
          loading={report.isPending}
          empty={(data?.by_user.length ?? 0) === 0}
          emptyMessage="No work logged yet"
        >
          <BarsChart
            layout="vertical"
            data={(data?.by_user ?? []).map((row) => ({
              name: row.user?.name ?? 'Unknown',
              hours: Number((row.minutes / 60).toFixed(1)),
            }))}
            xKey="name"
            series={[{ key: 'hours', label: 'Hours', color: 'var(--series-3)' }]}
            formatValue={(value) => `${value}h`}
          />
        </ChartCard>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="p-4 text-left text-sm font-semibold">Most time spent</caption>
          <thead>
            <tr className="border-y border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Issue</th>
              <th className="px-4 py-2 font-medium">Estimate</th>
              <th className="px-4 py-2 font-medium">Logged</th>
              <th className="px-4 py-2 font-medium">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {(data?.top_issues ?? []).map((row) => (
              <tr key={row.task_id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2">
                  <Link to={routes.issue(row.key)} className="hover:underline">
                    <span className="mr-2 text-muted-foreground">{row.key}</span>
                    {row.title}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {row.estimate_minutes === null ? '—' : formatDuration(row.estimate_minutes)}
                </td>
                <td className="px-4 py-2">{formatHours(row.spent_minutes)}</td>
                <td className="px-4 py-2">
                  {row.remaining_minutes === null ? '—' : formatDuration(row.remaining_minutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.isPending && (data?.top_issues.length ?? 0) === 0 && (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No work has been logged yet.</p>
        )}
      </Card>
    </div>
  )
}

function TeamReports({ projectId }: { projectId: string }) {
  const workload = useWorkload(projectId)
  const rows = workload.data?.rows ?? []
  const data = rows.map((row) => ({
    name: row.user?.name ?? 'Unassigned',
    issues: row.count,
    points: row.points,
  }))
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard
        title="Open issues per assignee"
        loading={workload.isPending}
        empty={rows.length === 0}
        emptyMessage="No open issues"
      >
        <BarsChart
          layout="vertical"
          data={data}
          xKey="name"
          series={[{ key: 'issues', label: 'Issues', color: 'var(--series-1)' }]}
        />
      </ChartCard>
      <ChartCard
        title="Open story points per assignee"
        loading={workload.isPending}
        empty={rows.length === 0}
        emptyMessage="No open issues"
      >
        <BarsChart
          layout="vertical"
          data={data}
          xKey="name"
          series={[{ key: 'points', label: 'Story points', color: 'var(--series-2)' }]}
        />
      </ChartCard>
    </div>
  )
}

export function ReportsPage() {
  const { projectId = '' } = useParams()
  const [tab, setTab] = useState<ReportTab>('agile')
  return (
    <section aria-label="Reports" className="flex flex-col gap-5">
      <Tabs
        ariaLabel="Report types"
        value={tab}
        onChange={(value) => setTab(value as ReportTab)}
        items={[
          { value: 'agile', label: 'Agile' },
          { value: 'time', label: 'Time tracking' },
          { value: 'team', label: 'Team workload' },
        ]}
      />
      {tab === 'agile' && <AgileReports projectId={projectId} />}
      {tab === 'time' && <TimeReports projectId={projectId} />}
      {tab === 'team' && <TeamReports projectId={projectId} />}
    </section>
  )
}
