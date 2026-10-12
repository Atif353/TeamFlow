import { api } from '@/lib/axios'
import type { Page, Role } from '@/types/common'
import type { Label, Project, ProjectListParams, ProjectMember, StatusInput } from '../types'
import type { ProjectInput } from '../schemas/projectSchemas'

export async function fetchProjects(params: ProjectListParams) {
  const { data } = await api.get<Page<Project>>('/projects', { params })
  return data
}

export async function fetchProject(projectId: string) {
  const { data } = await api.get<Project>(`/projects/${projectId}`)
  return data
}

export async function createProject(input: ProjectInput) {
  const { data } = await api.post<Project>('/projects', input)
  return data
}

export async function updateProject(
  projectId: string,
  input: Partial<Pick<ProjectInput, 'name' | 'description' | 'color'>>,
) {
  const { data } = await api.patch<Project>(`/projects/${projectId}`, input)
  return data
}

export async function deleteProject(projectId: string) {
  await api.delete(`/projects/${projectId}`)
}

export async function fetchProjectMembers(projectId: string) {
  const { data } = await api.get<Page<ProjectMember>>(`/projects/${projectId}/members`, {
    params: { page_size: 100 },
  })
  return data
}

export async function addProjectMember(projectId: string, userId: string, roleOverride?: Role) {
  const { data } = await api.post<ProjectMember>(`/projects/${projectId}/members`, {
    user_id: userId,
    role_override: roleOverride ?? null,
  })
  return data
}

export async function removeProjectMember(projectId: string, userId: string) {
  await api.delete(`/projects/${projectId}/members/${userId}`)
}

export async function updateStatuses(projectId: string, statuses: StatusInput[]) {
  const { data } = await api.put<Project>(`/projects/${projectId}/statuses`, { statuses })
  return data
}

export async function updateWorkflow(projectId: string, transitions: Record<string, string[]>) {
  const { data } = await api.put<Project>(`/projects/${projectId}/workflow`, { transitions })
  return data
}

export async function fetchLabels(projectId: string) {
  const { data } = await api.get<Label[]>(`/projects/${projectId}/labels`)
  return data
}

export async function createLabel(projectId: string, input: { name: string; color: string }) {
  const { data } = await api.post<Label>(`/projects/${projectId}/labels`, input)
  return data
}

export async function updateLabel(labelId: string, input: { name?: string; color?: string }) {
  const { data } = await api.patch<Label>(`/labels/${labelId}`, input)
  return data
}

export async function deleteLabel(labelId: string) {
  await api.delete(`/labels/${labelId}`)
}
