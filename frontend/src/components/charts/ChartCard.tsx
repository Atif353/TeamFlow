import { BarChart3, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

export interface ChartTable {
  headers: string[]
  rows: (string | number)[][]
}

interface ChartCardProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  height?: number
  auto?: boolean
  table?: ChartTable
  className?: string
  children: ReactNode
}

function DataTable({ table }: { table: ChartTable }) {
  return (
    <div className="max-h-60 overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-muted text-left text-xs text-muted-foreground">
          <tr>
            {table.headers.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {row.map((cell, position) => (
                <td key={position} className="px-3 py-1.5 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ChartCard({
  title,
  subtitle,
  actions,
  loading = false,
  empty = false,
  emptyMessage = 'No data yet',
  height = 240,
  auto = false,
  table,
  className,
  children,
}: ChartCardProps) {
  const [asTable, setAsTable] = useState(false)
  const showToggle = Boolean(table) && !loading && !empty
  return (
    <Card className={cn('flex flex-col gap-4 p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {showToggle && (
            <button
              type="button"
              aria-pressed={asTable}
              aria-label={asTable ? `Show ${title} as chart` : `Show ${title} as table`}
              title={asTable ? 'Show as chart' : 'Show as table'}
              onClick={() => setAsTable((value) => !value)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div
          role="status"
          aria-label="Loading chart"
          style={{ height: auto ? 96 : height }}
          className="w-full animate-pulse rounded-lg bg-surface-muted"
        />
      ) : empty ? (
        <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
          <BarChart3 size={16} aria-hidden="true" />
          {emptyMessage}
        </div>
      ) : asTable && table ? (
        <DataTable table={table} />
      ) : (
        <div style={auto ? undefined : { height }} className="w-full min-w-0">
          {children}
        </div>
      )}
    </Card>
  )
}
