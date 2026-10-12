import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { AXIS_PROPS, GRID_COLOR, seriesColor } from './chartTheme'

export interface BarSeries {
  key: string
  label: string
  color?: string
}

interface BarsChartProps {
  data: object[]
  xKey: string
  series: BarSeries[]
  layout?: 'vertical' | 'horizontal'
  stacked?: boolean
  formatValue?: (value: number, name: string) => string
  formatTick?: (value: string | number) => string
}

export function BarsChart({
  data,
  xKey,
  series,
  layout = 'horizontal',
  stacked = false,
  formatValue,
  formatTick,
}: BarsChartProps) {
  const vertical = layout === 'vertical'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={vertical ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 8, bottom: 0, left: vertical ? 8 : -12 }}
        barCategoryGap="28%"
      >
        <CartesianGrid
          stroke={GRID_COLOR}
          strokeDasharray="3 3"
          vertical={vertical}
          horizontal={!vertical}
        />
        {vertical ? (
          <>
            <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey={xKey}
              width={96}
              {...AXIS_PROPS}
              tickFormatter={formatTick}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...AXIS_PROPS} tickFormatter={formatTick} minTickGap={12} />
            <YAxis {...AXIS_PROPS} allowDecimals={false} />
          </>
        )}
        <Tooltip
          cursor={{ fill: 'rgb(var(--surface-muted))', opacity: 0.6 }}
          content={<ChartTooltip formatValue={formatValue} />}
        />
        {series.length > 1 && <Legend iconType="square" iconSize={10} />}
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            fill={item.color ?? seriesColor(index)}
            stackId={stacked ? 'stack' : undefined}
            radius={stacked ? 0 : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
