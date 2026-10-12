import type { Project } from '../types'

export function allowedStatusIds(
  project: Pick<Project, 'statuses' | 'transitions'>,
  sourceId: string,
): ReadonlySet<string> {
  const restricted = project.transitions[sourceId]
  const everything = project.statuses.map((status) => status.id)
  return new Set(restricted ? [sourceId, ...restricted] : everything)
}

export function isTransitionAllowed(
  project: Pick<Project, 'statuses' | 'transitions'>,
  sourceId: string,
  targetId: string,
): boolean {
  return allowedStatusIds(project, sourceId).has(targetId)
}
