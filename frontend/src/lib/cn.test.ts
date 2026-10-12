import { cn } from './cn'

describe('cn', () => {
  it('merges conflicting tailwind classes keeping the last', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('drops falsy values', () => {
    expect(cn('a', null, false, undefined, 'c')).toBe('a c')
  })
})
