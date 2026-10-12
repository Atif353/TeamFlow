const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 8
const DAYS_PER_WEEK = 5

const UNIT_MINUTES: Record<string, number> = {
  w: DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR,
  d: HOURS_PER_DAY * MINUTES_PER_HOUR,
  h: MINUTES_PER_HOUR,
  m: 1,
}

const TOKEN = /^(\d+(?:\.\d+)?)\s*([wdhm])$/i

export function parseDuration(input: string): number | null {
  const text = input.trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Number(text)
  const parts = text.split(/\s+/)
  let total = 0
  for (const part of parts) {
    const match = TOKEN.exec(part)
    if (!match) return null
    total += Math.round(Number(match[1]) * (UNIT_MINUTES[match[2]!.toLowerCase()] ?? 0))
  }
  return total > 0 ? total : null
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '0m'
  let left = minutes
  const parts: string[] = []
  for (const unit of ['w', 'd', 'h', 'm']) {
    const size = UNIT_MINUTES[unit]!
    const count = Math.floor(left / size)
    if (count > 0) {
      parts.push(`${count}${unit}`)
      left -= count * size
    }
  }
  return parts.join(' ')
}

export function formatHours(minutes: number): string {
  const hours = minutes / MINUTES_PER_HOUR
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
}
