import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/axios'
import type { Role } from '@/types/common'
import {
  addProjectMember,
  createLabel,
  createProject,
  deleteLabel,
  deleteProject,
  fetchLabels,
  fetchProject,
  fetchProjectMembers,
  fetchProjects,
  removeProjectMember,
  updateLabel,
  updateProject,
  updateStatuses,
  updateWorkflow,
} from '../api/projectsApi'
import type { ProjectListParams, StatusInput } from '../types'

export const projectKeys = {
  all: ['projects'] as const,
  list: (params: ProjectListParams) => ['projects', 'list', params] as const,
  detail: (projectId: string) => ['projects', 'detail', projectId] as const,
  members: (projectId: string) => ['projects', 'detail', projectId, 'members'] as const,
  labels: (projectId: string) => ['projects', 'detail', projectId, 'labels'] as const,
}

export function useProjects(params: ProjectListParams) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => fetchProjects(params),
    placeholderData: keepPreviousData,
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
    retry: false,
  })
}

export function useCreateProject() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKeys.all })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateProject(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof updateProject>[1]) => updateProject(projectId, input),
    onSuccess: (project) => {
      client.setQueryData(projectKeys.detail(projectId), project)
      void client.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDeleteProject() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKeys.all })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: () => fetchProjectMembers(projectId),
  })
}

export function useAddProjectMember(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role?: Role }) =>
      addProjectMember(projectId, userId, role),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKeys.members(projectId) })
      void client.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useRemoveProjectMember(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKeys.members(projectId) })
      void client.invalidateQueries({ queryKey: ['projects', 'list'] })
      void client.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateStatuses(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (statuses: StatusInput[]) => updateStatuses(projectId, statuses),
    onSuccess: (project) => {
      client.setQueryData(projectKeys.detail(projectId), project)
      void client.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateWorkflow(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (transitions: Record<string, string[]>) => updateWorkflow(projectId, transitions),
    onSuccess: (project) => client.setQueryData(projectKeys.detail(projectId), project),
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useLabels(projectId: string) {
  return useQuery({
    queryKey: projectKeys.labels(projectId),
    queryFn: () => fetchLabels(projectId),
  })
}

export function useCreateLabel(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; color: string }) => createLabel(projectId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.labels(projectId) }),
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateLabel(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; color?: string }) =>
      updateLabel(id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKeys.labels(projectId) })
      void client.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDeleteLabel(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteLabel,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: projectKeys.labels(projectId) })
      void client.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
