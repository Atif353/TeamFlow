import { can, canDeleteTask, canEditTask, type Permission } from './roles'
import type { Role } from '@/types/common'

const SUPER = 'super_admin'
const MANAGER = 'project_manager'
const MEMBER = 'member'
const VIEWER = 'viewer'

const MATRIX: Record<Permission, Record<Role, boolean>> = {
  'user:manage': { [SUPER]: true, [MANAGER]: false, [MEMBER]: false, [VIEWER]: false },
  'admin:access': { [SUPER]: true, [MANAGER]: false, [MEMBER]: false, [VIEWER]: false },
  'project:create': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
  'project:delete': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
  'project:members': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
  'project:view': { [SUPER]: true, [MANAGER]: true, [MEMBER]: true, [VIEWER]: true },
  'task:create': { [SUPER]: true, [MANAGER]: true, [MEMBER]: true, [VIEWER]: false },
  'task:edit_any': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
  'task:edit_own': { [SUPER]: true, [MANAGER]: true, [MEMBER]: true, [VIEWER]: false },
  'task:delete_any': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
  'task:delete_own': { [SUPER]: true, [MANAGER]: true, [MEMBER]: true, [VIEWER]: false },
  'comment:create': { [SUPER]: true, [MANAGER]: true, [MEMBER]: true, [VIEWER]: false },
  'comment:delete_any': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
  'doc:write': { [SUPER]: true, [MANAGER]: true, [MEMBER]: true, [VIEWER]: false },
  'sprint:manage': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
  'automation:manage': { [SUPER]: true, [MANAGER]: true, [MEMBER]: false, [VIEWER]: false },
}

describe('permission matrix mirrors the server', () => {
  const cases = Object.entries(MATRIX).flatMap(([permission, byRole]) =>
    Object.entries(byRole).map(([role, allowed]) => [permission, role, allowed] as const),
  )

  it.each(cases)('%s for %s is %s', (permission, role, allowed) => {
    expect(can(role as Role, permission as Permission)).toBe(allowed)
  })

  it('denies everything when there is no role', () => {
    expect(can(null, 'project:view')).toBe(false)
    expect(can(undefined, 'task:create')).toBe(false)
  })
})

describe('task ownership rules', () => {
  const task = { creator_id: 'a', assignee_id: 'b' }

  it('lets members edit tasks they created or are assigned to', () => {
    expect(canEditTask('member', 'a', task)).toBe(true)
    expect(canEditTask('member', 'b', task)).toBe(true)
    expect(canEditTask('member', 'c', task)).toBe(false)
  })

  it('lets managers act on any task and blocks viewers', () => {
    expect(canEditTask('project_manager', 'c', task)).toBe(true)
    expect(canDeleteTask('project_manager', 'c', task)).toBe(true)
    expect(canEditTask('viewer', 'a', task)).toBe(false)
    expect(canDeleteTask('member', 'c', task)).toBe(false)
  })
})
