import { api } from '@/lib/axios'
import type {
  AutomationRule,
  AutomationRuleInput,
  Backlog,
  BurndownReport,
  CumulativeFlowReport,
  ProjectSummary,
  SavedFilter,
  SearchResults,
  Sprint,
  SprintInput,
  SprintState,
  TimeTrackingReport,
  VelocityReport,
  Version,
  VersionInput,
  WorkloadReport,
} from '../types'
import type { Project } from '@/features/projects/types'

export async function fetchSprints(projectId: string, states?: SprintState[]) {
  const { data } = await api.get<Sprint[]>(`/projects/${projectId}/sprints`, {
    params: { state: states },
    paramsSerializer: { indexes: null },
  })
  return data
}

export async function fetchBacklog(projectId: string) {
  const { data } = await api.get<Backlog>(`/projects/${projectId}/backlog`)
  return data
}

export async function createSprint(projectId: string, input: SprintInput) {
  const { data } = await api.post<Sprint>(`/projects/${projectId}/sprints`, input)
  return data
}

export async function updateSprint(sprintId: string, input: Partial<SprintInput>) {
  const { data } = await api.patch<Sprint>(`/sprints/${sprintId}`, input)
  return data
}

export async function startSprint(
  sprintId: string,
  input: { start_date?: string | null; end_date?: string | null },
) {
  const { data } = await api.post<Sprint>(`/sprints/${sprintId}/start`, input)
  return data
}

export async function completeSprint(sprintId: string, moveToSprintId: string | null) {
  const { data } = await api.post<Sprint>(`/sprints/${sprintId}/complete`, {
    move_to_sprint_id: moveToSprintId,
  })
  return data
}

export async function deleteSprint(sprintId: string) {
  await api.delete(`/sprints/${sprintId}`)
}

export async function fetchVersions(projectId: string) {
  const { data } = await api.get<Version[]>(`/projects/${projectId}/versions`)
  return data
}

export async function createVersion(projectId: string, input: VersionInput) {
  const { data } = await api.post<Version>(`/projects/${projectId}/versions`, input)
  return data
}

export async function updateVersion(
  versionId: string,
  input: Partial<VersionInput> & { released?: boolean },
) {
  const { data } = await api.patch<Version>(`/versions/${versionId}`, input)
  return data
}

export async function deleteVersion(versionId: string) {
  await api.delete(`/versions/${versionId}`)
}

export async function updateComponents(projectId: string, components: string[]) {
  const { data } = await api.put<Project>(`/projects/${projectId}/components`, { components })
  return data
}

export async function fetchSummary(projectId: string) {
  const { data } = await api.get<ProjectSummary>(`/projects/${projectId}/summary`)
  return data
}

export async function fetchBurndown(sprintId: string) {
  const { data } = await api.get<BurndownReport>(`/sprints/${sprintId}/burndown`)
  return data
}

export async function fetchVelocity(projectId: string) {
  const { data } = await api.get<VelocityReport>(`/projects/${projectId}/reports/velocity`)
  return data
}

export async function fetchCumulativeFlow(projectId: string) {
  const { data } = await api.get<CumulativeFlowReport>(
    `/projects/${projectId}/reports/cumulative-flow`,
  )
  return data
}

export async function fetchTimeTracking(projectId: string, days: number) {
  const { data } = await api.get<TimeTrackingReport>(
    `/projects/${projectId}/reports/time-tracking`,
    { params: { days } },
  )
  return data
}

export async function fetchWorkload(projectId: string) {
  const { data } = await api.get<WorkloadReport>(`/projects/${projectId}/reports/workload`)
  return data
}

export async function fetchFilters(projectId: string) {
  const { data } = await api.get<SavedFilter[]>(`/projects/${projectId}/filters`)
  return data
}

export async function createFilter(
  projectId: string,
  name: string,
  params: Record<string, string>,
) {
  const { data } = await api.post<SavedFilter>(`/projects/${projectId}/filters`, { name, params })
  return data
}

export async function deleteFilter(filterId: string) {
  await api.delete(`/filters/${filterId}`)
}

export async function fetchRules(projectId: string) {
  const { data } = await api.get<AutomationRule[]>(`/projects/${projectId}/automation`)
  return data
}

export async function createRule(projectId: string, input: AutomationRuleInput) {
  const { data } = await api.post<AutomationRule>(`/projects/${projectId}/automation`, input)
  return data
}

export async function updateRule(ruleId: string, input: { name?: string; enabled?: boolean }) {
  const { data } = await api.patch<AutomationRule>(`/automation/${ruleId}`, input)
  return data
}

export async function deleteRule(ruleId: string) {
  await api.delete(`/automation/${ruleId}`)
}

export async function search(query: string) {
  const { data } = await api.get<SearchResults>('/search', { params: { q: query } })
  return data
}
