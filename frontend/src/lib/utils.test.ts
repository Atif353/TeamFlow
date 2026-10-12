import { groupByStatus, isSamePlacement, neighborsOf } from '@/features/board/utils/grouping'
import { buildTask, STATUSES } from '@/test/fixtures'
import { greeting, initials, isOverdueDate, percent } from './formatters'
import { POSITION_STEP, positionBetween } from './positions'

describe('positionBetween', () => {
  it('starts an empty column at one step', () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP)
  })

  it('appends, prepends and averages', () => {
    expect(positionBetween(2048, null)).toBe(3072)
    expect(positionBetween(null, 1024)).toBe(0)
    expect(positionBetween(1024, 2048)).toBe(1536)
  })
})

describe('formatters', () => {
  it('builds initials from one or many words', () => {
    expect(initials('Ada Lovelace')).toBe('AL')
    expect(initials('  grace  ')).toBe('G')
    expect(initials('')).toBe('?')
  })

  it('computes safe percentages', () => {
    expect(percent(1, 3)).toBe(33)
    expect(percent(0, 0)).toBe(0)
  })

  it('flags past dates but not today as overdue', () => {
    expect(isOverdueDate('2000-01-01')).toBe(true)
    expect(isOverdueDate(new Date().toISOString().slice(0, 10))).toBe(false)
    expect(isOverdueDate(null)).toBe(false)
  })

  it('greets by time of day', () => {
    expect(greeting(new Date('2026-01-01T08:00:00'))).toBe('Good morning')
    expect(greeting(new Date('2026-01-01T14:00:00'))).toBe('Good afternoon')
    expect(greeting(new Date('2026-01-01T20:00:00'))).toBe('Good evening')
  })
})

describe('board grouping', () => {
  const tasks = [
    buildTask({ id: 'b', status_id: 's-todo', position: 2048 }),
    buildTask({ id: 'a', status_id: 's-todo', position: 1024 }),
    buildTask({ id: 'c', status_id: 's-done', position: 1024 }),
  ]

  it('groups by status in position order and keeps empty columns', () => {
    expect(groupByStatus(tasks, STATUSES)).toEqual({
      's-todo': ['a', 'b'],
      's-progress': [],
      's-review': [],
      's-done': ['c'],
    })
  })

  it('finds neighbours', () => {
    expect(neighborsOf(['a', 'b', 'c'], 'b')).toEqual({ previous: 'a', next: 'c' })
    expect(neighborsOf(['a'], 'a')).toEqual({ previous: null, next: null })
  })

  it('recognises an unchanged placement', () => {
    const original = groupByStatus(tasks, STATUSES)

    expect(isSamePlacement(original, 's-todo', 'a', null, 'b')).toBe(true)
    expect(isSamePlacement(original, 's-todo', 'a', 'b', null)).toBe(false)
    expect(isSamePlacement(original, 's-done', 'a', null, null)).toBe(false)
  })
})
