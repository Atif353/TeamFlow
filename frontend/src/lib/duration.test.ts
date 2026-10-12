import { describe, expect, it } from 'vitest'
import { formatDuration, formatHours, parseDuration } from './duration'

describe('parseDuration', () => {
  it('parses Jira style tokens', () => {
    expect(parseDuration('2h 30m')).toBe(150)
    expect(parseDuration('1d')).toBe(480)
    expect(parseDuration('1w')).toBe(2400)
    expect(parseDuration('1w 2d 3h 4m')).toBe(2400 + 960 + 180 + 4)
    expect(parseDuration('1.5h')).toBe(90)
  })

  it('treats bare numbers as minutes', () => {
    expect(parseDuration('45')).toBe(45)
  })

  it('rejects invalid input', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('2x')).toBeNull()
    expect(parseDuration('0m')).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats minutes using working units', () => {
    expect(formatDuration(150)).toBe('2h 30m')
    expect(formatDuration(480)).toBe('1d')
    expect(formatDuration(2400 + 60)).toBe('1w 1h')
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(null)).toBe('0m')
  })

  it('formats hours', () => {
    expect(formatHours(120)).toBe('2h')
    expect(formatHours(90)).toBe('1.5h')
  })
})
