import { format, formatDistanceToNow, isPast, isToday, parseISO } from 'date-fns'

export function parseDate(value: string): Date {
  return parseISO(value)
}

export function formatDate(value: string | null | undefined): string {
  return value ? format(parseDate(value), 'MMM d, yyyy') : '—'
}

export function formatShortDate(value: string): string {
  return format(parseDate(value), 'MMM d')
}

export function formatRelative(value: string | null | undefined): string {
  return value ? formatDistanceToNow(parseDate(value), { addSuffix: true }) : 'Never'
}

export function isOverdueDate(value: string | null | undefined): boolean {
  if (!value) return false
  const date = parseDate(value)
  return isPast(date) && !isToday(date)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
