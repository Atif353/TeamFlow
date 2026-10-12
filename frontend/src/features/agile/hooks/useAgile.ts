import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { projectKeys } from '@/features/projects/hooks/useProjects'
import { invalidateProject } from '@/features/tasks/hooks/useTasks'
import { errorMessage } from '@/lib/axios'
import {
  completeSprint,
  createFilter,
  createRule,
  createSprint,
  createVersion,
  deleteFilter,
  deleteRule,
  deleteSprint,
  deleteVersion,
  fetchBacklog,
  fetchBurndown,
  fetchCumulativeFlow,
  fetchFilters,
  fetchRules,
  fetchSprints,
  fetchSummary,
  fetchTimeTracking,
  fetchVelocity,
  fetchVersions,
  fetchWorkload,
  search,
  startSprint,
  updateComponents,
  updateRule,
  updateSprint,
  updateVersion,
} from '../api/agileApi'
import type { AutomationRuleInput, SprintInput, SprintState, VersionInput } from '../types'

export const agileKeys = {
  backlog: (projectId: string) => ['backlog', projectId] as const,
  sprints: (projectId: string, states?: SprintState[]) =>
    ['sprints', projectId, states ?? 'all'] as const,
  versions: (projectId: string) => ['versions', projectId] as const,
  summary: (projectId: string) => ['summary', projectId] as const,
  burndown: (sprintId: string) => ['reports', 'burndown', sprintId] as const,
  velocity: (projectId: string) => ['reports', projectId, 'velocity'] as const,
  flow: (projectId: string) => ['reports', projectId, 'flow'] as const,
  time: (projectId: string, days: number) => ['reports', projectId, 'time', days] as const,
  workload: (projectId: string) => ['reports', projectId, 'workload'] as const,
  filters: (projectId: string) => ['filters', projectId] as const,
  rules: (projectId: string) => ['automation', projectId] as const,
  search: (query: string) => ['search', query] as const,
}

export function useBacklog(projectId: string) {
  return useQuery({
    queryKey: agileKeys.backlog(projectId),
    queryFn: () => fetchBacklog(projectId),
  })
}

export function useSprints(projectId: string, states?: SprintState[]) {
  return useQuery({
    queryKey: agileKeys.sprints(projectId, states),
    queryFn: () => fetchSprints(projectId, states),
  })
}

export function useSprintActions(projectId: string) {
  const client = useQueryClient()
  const onSuccess = () => invalidateProject(client, projectId)
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    create: useMutation({
      mutationFn: (input: SprintInput) => createSprint(projectId, input),
      onSuccess,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<SprintInput> }) =>
        updateSprint(id, input),
      onSuccess,
      onError,
    }),
    start: useMutation({
      mutationFn: ({
        id,
        ...input
      }: {
        id: string
        start_date?: string | null
        end_date?: string | null
      }) => startSprint(id, input),
      onSuccess,
      onError,
    }),
    complete: useMutation({
      mutationFn: ({ id, moveTo }: { id: string; moveTo: string | null }) =>
        completeSprint(id, moveTo),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteSprint, onSuccess, onError }),
  }
}

export function useVersions(projectId: string) {
  return useQuery({
    queryKey: agileKeys.versions(projectId),
    queryFn: () => fetchVersions(projectId),
  })
}

export function useVersionActions(projectId: string) {
  const client = useQueryClient()
  const onSuccess = () => invalidateProject(client, projectId)
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    create: useMutation({
      mutationFn: (input: VersionInput) => createVersion(projectId, input),
      onSuccess,
      onError,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string
        input: Partial<VersionInput> & { released?: boolean }
      }) => updateVersion(id, input),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteVersion, onSuccess, onError }),
  }
}

export function useComponentsUpdate(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (components: string[]) => updateComponents(projectId, components),
    onSuccess: (project) => {
      client.setQueryData(projectKeys.detail(projectId), project)
      void client.invalidateQueries({ queryKey: ['projects', 'list'] })
      toast.success('Components saved')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useSummary(projectId: string) {
  return useQuery({
    queryKey: agileKeys.summary(projectId),
    queryFn: () => fetchSummary(projectId),
  })
}

export function useBurndown(sprintId: string | null) {
  return useQuery({
    queryKey: agileKeys.burndown(sprintId ?? ''),
    queryFn: () => fetchBurndown(sprintId as string),
    enabled: Boolean(sprintId),
  })
}

export function useVelocity(projectId: string) {
  return useQuery({
    queryKey: agileKeys.velocity(projectId),
    queryFn: () => fetchVelocity(projectId),
  })
}

export function useCumulativeFlow(projectId: string) {
  return useQuery({
    queryKey: agileKeys.flow(projectId),
    queryFn: () => fetchCumulativeFlow(projectId),
  })
}

export function useTimeTracking(projectId: string, days: number) {
  return useQuery({
    queryKey: agileKeys.time(projectId, days),
    queryFn: () => fetchTimeTracking(projectId, days),
  })
}

export function useWorkload(projectId: string) {
  return useQuery({
    queryKey: agileKeys.workload(projectId),
    queryFn: () => fetchWorkload(projectId),
  })
}

export function useSavedFilters(projectId: string) {
  return useQuery({
    queryKey: agileKeys.filters(projectId),
    queryFn: () => fetchFilters(projectId),
  })
}

export function useSavedFilterActions(projectId: string) {
  const client = useQueryClient()
  const onSuccess = () => void client.invalidateQueries({ queryKey: agileKeys.filters(projectId) })
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    create: useMutation({
      mutationFn: ({ name, params }: { name: string; params: Record<string, string> }) =>
        createFilter(projectId, name, params),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteFilter, onSuccess, onError }),
  }
}

export function useRules(projectId: string) {
  return useQuery({ queryKey: agileKeys.rules(projectId), queryFn: () => fetchRules(projectId) })
}

export function useRuleActions(projectId: string) {
  const client = useQueryClient()
  const onSuccess = () => void client.invalidateQueries({ queryKey: agileKeys.rules(projectId) })
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    create: useMutation({
      mutationFn: (input: AutomationRuleInput) => createRule(projectId, input),
      onSuccess,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string; name?: string; enabled?: boolean }) =>
        updateRule(id, input),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteRule, onSuccess, onError }),
  }
}

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: agileKeys.search(query),
    queryFn: () => search(query),
    enabled: query.trim().length > 0,
  })
}
