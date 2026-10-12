import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { MOBILE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { Skeleton } from './Skeleton'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortable?: boolean
  className?: string
  hideOnMobile?: boolean
}

export interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  empty: ReactNode
  caption: string
  selectedKeys?: ReadonlySet<string>
  onSelectionChange?: (keys: Set<string>) => void
}

function nextSort(current: SortState | undefined, key: string): SortState {
  if (current?.key === key && current.direction === 'asc') return { key, direction: 'desc' }
  return { key, direction: 'asc' }
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  sort,
  onSortChange,
  onRowClick,
  rowLabel,
  empty,
  caption,
  selectedKeys,
  onSelectionChange,
}: DataTableProps<T>) {
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const selectable = Boolean(selectedKeys && onSelectionChange)
  const toggleRow = (key: string, checked: boolean) => {
    if (!selectedKeys || !onSelectionChange) return
    const next = new Set(selectedKeys)
    if (checked) next.add(key)
    else next.delete(key)
    onSelectionChange(next)
  }
  const allSelected =
    selectable && rows.length > 0 && rows.every((row) => selectedKeys?.has(rowKey(row)))

  if (loading) {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) return <>{empty}</>

  if (isMobile) {
    const [primary, ...rest] = columns
    return (
      <ul aria-label={caption} className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick ? rowLabel?.(row) : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onRowClick(row)
                }
              }}
              className={cn(
                'flex flex-col gap-3 rounded-xl border border-border bg-surface p-4',
                onRowClick && 'cursor-pointer active:bg-surface-muted',
              )}
            >
              {selectable && (
                <input
                  type="checkbox"
                  aria-label={`Select ${rowLabel?.(row) ?? 'row'}`}
                  checked={selectedKeys?.has(rowKey(row)) ?? false}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => toggleRow(rowKey(row), event.target.checked)}
                  className="h-4 w-4 self-start accent-primary-600"
                />
              )}
              {primary && <div className="font-medium">{primary.render(row)}</div>}
              {rest
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{column.header}</span>
                    <span className="min-w-0 text-right">{column.render(row)}</span>
                  </div>
                ))}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium text-muted-foreground">
          <tr>
            {selectable && (
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  onChange={(event) =>
                    onSelectionChange?.(
                      event.target.checked ? new Set(rows.map((row) => rowKey(row))) : new Set(),
                    )
                  }
                  className="h-4 w-4 accent-primary-600"
                />
              </th>
            )}
            {columns.map((column) => {
              const active = sort?.key === column.key
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={cn('px-4 py-3 font-medium', column.className)}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(nextSort(sort, column.key))}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {column.header}
                      {active ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={12} aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown size={12} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick ? rowLabel?.(row) : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (onRowClick && event.key === 'Enter') onRowClick(row)
              }}
              className={cn(
                'transition-colors',
                onRowClick && 'cursor-pointer hover:bg-surface-muted/60',
              )}
            >
              {selectable && (
                <td className="w-10 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${rowLabel?.(row) ?? 'row'}`}
                    checked={selectedKeys?.has(rowKey(row)) ?? false}
                    onChange={(event) => toggleRow(rowKey(row), event.target.checked)}
                    className="h-4 w-4 accent-primary-600"
                  />
                </td>
              )}
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
