import { format } from 'date-fns'

export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}
