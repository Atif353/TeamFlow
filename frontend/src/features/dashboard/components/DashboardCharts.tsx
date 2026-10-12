import { BarsChart } from '@/components/charts/BarsChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { BreakdownBar } from '@/components/charts/BreakdownBar'
import { formatDuration } from '@/lib/duration'
import type { DashboardCharts as Charts } from '../types'

interface DashboardChartsProps {
  charts: Charts | undefined
  loading: boolean
}

export function DashboardCharts({ charts, loading }: DashboardChartsProps) {
  const noOpen = (charts?.by_status.length ?? 0) === 0
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartCard
        auto
        title="My open work by status"
        loading={loading}
        empty={noOpen}
        emptyMessage="No open work assigned to you"
      >
        <BreakdownBar items={charts?.by_status ?? []} />
      </ChartCard>
      <ChartCard
        auto
        title="My open work by type"
        loading={loading}
        empty={(charts?.by_type.length ?? 0) === 0}
        emptyMessage="No open work assigned to you"
      >
        <BreakdownBar items={charts?.by_type ?? []} />
      </ChartCard>
      <ChartCard
        title="Completed per day"
        table={{
          headers: ['Date', 'Completed'],
          rows: (charts?.completed_per_day ?? []).map((day) => [day.date, day.count]),
        }}
        subtitle="Last 14 days"
        loading={loading}
        empty={(charts?.completed_per_day.every((day) => day.count === 0) ?? true) && !loading}
        emptyMessage="Nothing completed recently"
      >
        <BarsChart
          data={charts?.completed_per_day ?? []}
          xKey="date"
          series={[{ key: 'count', label: 'Completed', color: 'var(--series-3)' }]}
          formatTick={(value) => String(value).slice(5)}
        />
      </ChartCard>
      <ChartCard
        title="Time logged"
        table={{
          headers: ['Date', 'Minutes'],
          rows: (charts?.logged_per_day ?? []).map((day) => [day.date, day.minutes]),
        }}
        subtitle={`${formatDuration(charts?.minutes_logged_week ?? 0)} this week`}
        loading={loading}
        empty={(charts?.logged_per_day.every((day) => day.minutes === 0) ?? true) && !loading}
        emptyMessage="No work logged recently"
      >
        <BarsChart
          data={(charts?.logged_per_day ?? []).map((day) => ({
            date: day.date,
            hours: Number((day.minutes / 60).toFixed(1)),
          }))}
          xKey="date"
          series={[{ key: 'hours', label: 'Hours', color: 'var(--series-1)' }]}
          formatValue={(value) => `${value}h`}
          formatTick={(value) => String(value).slice(5)}
        />
      </ChartCard>
    </div>
  )
}
