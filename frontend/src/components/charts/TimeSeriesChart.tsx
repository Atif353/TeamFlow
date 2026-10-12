import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { AXIS_PROPS, GRID_COLOR, seriesColor, SURFACE_COLOR } from './chartTheme'

export interface TimeSeries {
  key: string
  label: string
  color?: string
  dashed?: boolean
}

interface TimeSeriesChartProps {
  data: object[]
  series: TimeSeries[]
  variant: 'line' | 'area' | 'stacked-area'
  xKey?: string
  formatValue?: (value: number, name: string) => string
}

function formatDay(value: string | number): string {
  return format(parseISO(String(value)), 'MMM d')
}

export function TimeSeriesChart({
  data,
  series,
  variant,
  xKey = 'date',
  formatValue,
}: TimeSeriesChartProps) {
  const common = (
    <>
      <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={xKey} {...AXIS_PROPS} tickFormatter={formatDay} minTickGap={24} />
      <YAxis {...AXIS_PROPS} allowDecimals={false} width={36} />
      <Tooltip
        cursor={{ stroke: GRID_COLOR }}
        content={<ChartTooltip formatLabel={formatDay} formatValue={formatValue} />}
      />
      {series.length > 1 && <Legend iconType="plainline" iconSize={14} />}
    </>
  )
  const margin = { top: 8, right: 8, bottom: 0, left: -8 }
  return (
    <ResponsiveContainer width="100%" height="100%">
      {variant === 'line' ? (
        <LineChart data={data} margin={margin}>
          {common}
          {series.map((item, index) => (
            <Line
              key={item.key}
              dataKey={item.key}
              name={item.label}
              type="monotone"
              stroke={item.color ?? seriesColor(index)}
              strokeWidth={2}
              strokeDasharray={item.dashed ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 4, stroke: SURFACE_COLOR, strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      ) : (
        <AreaChart data={data} margin={margin}>
          {common}
          {series.map((item, index) => {
            const color = item.color ?? seriesColor(index)
            return (
              <Area
                key={item.key}
                dataKey={item.key}
                name={item.label}
                type="monotone"
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={variant === 'stacked-area' ? 0.85 : 0.18}
                stackId={variant === 'stacked-area' ? 'flow' : undefined}
                dot={false}
                isAnimationActive={false}
              />
            )
          })}
        </AreaChart>
      )}
    </ResponsiveContainer>
  )
}
