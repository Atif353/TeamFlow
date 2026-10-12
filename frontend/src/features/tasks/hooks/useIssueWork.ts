import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { LinkType } from '@/config/issueTypes'
import { errorMessage } from '@/lib/axios'
import {
  createLink,
  createWorklog,
  deleteAttachment,
  deleteLink,
  deleteWorklog,
  fetchAttachments,
  fetchLinks,
  fetchWorklogs,
  updateWorklog,
  uploadAttachment,
} from '../api/tasksApi'
import type { WorklogInput } from '../types'
import { invalidateProject, invalidateTaskDetail } from './useTasks'

export const workKeys = {
  worklogs: (taskId: string) => ['task', taskId, 'worklogs'] as const,
  links: (taskId: string) => ['task', taskId, 'links'] as const,
  attachments: (taskId: string) => ['task', taskId, 'attachments'] as const,
}

function useRefreshTask(projectId: string, taskId: string) {
  const client = useQueryClient()
  return () => {
    invalidateTaskDetail(client, taskId)
    invalidateProject(client, projectId)
  }
}

export function useWorklogs(taskId: string) {
  return useQuery({ queryKey: workKeys.worklogs(taskId), queryFn: () => fetchWorklogs(taskId) })
}

export function useWorklogActions(projectId: string, taskId: string) {
  const client = useQueryClient()
  const refresh = useRefreshTask(projectId, taskId)
  const onSuccess = () => {
    void client.invalidateQueries({ queryKey: workKeys.worklogs(taskId) })
    refresh()
  }
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    add: useMutation({
      mutationFn: (input: WorklogInput) => createWorklog(taskId, input),
      onSuccess,
      onError,
    }),
    edit: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<WorklogInput> }) =>
        updateWorklog(id, input),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteWorklog, onSuccess, onError }),
  }
}

export function useLinks(taskId: string) {
  return useQuery({ queryKey: workKeys.links(taskId), queryFn: () => fetchLinks(taskId) })
}

export function useLinkActions(projectId: string, taskId: string) {
  const client = useQueryClient()
  const refresh = useRefreshTask(projectId, taskId)
  const onSuccess = () => {
    void client.invalidateQueries({ queryKey: workKeys.links(taskId) })
    refresh()
  }
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    add: useMutation({
      mutationFn: ({ target, linkType }: { target: string; linkType: LinkType }) =>
        createLink(taskId, target, linkType),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteLink, onSuccess, onError }),
  }
}

export function useAttachments(taskId: string) {
  return useQuery({
    queryKey: workKeys.attachments(taskId),
    queryFn: () => fetchAttachments(taskId),
  })
}

export function useAttachmentActions(projectId: string, taskId: string) {
  const client = useQueryClient()
  const refresh = useRefreshTask(projectId, taskId)
  const onSuccess = () => {
    void client.invalidateQueries({ queryKey: workKeys.attachments(taskId) })
    refresh()
  }
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    upload: useMutation({
      mutationFn: (file: File) => uploadAttachment(taskId, file),
      onSuccess,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteAttachment, onSuccess, onError }),
  }
}
