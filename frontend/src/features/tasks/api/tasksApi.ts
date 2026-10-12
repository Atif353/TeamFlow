import { api } from '@/lib/axios'
import type { Page } from '@/types/common'
import type {
  ActivityEntry,
  Attachment,
  BulkResult,
  IssueLink,
  Task,
  TaskCreateInput,
  TaskListParams,
  TaskMoveInput,
  TaskRankInput,
  TaskUpdateInput,
  Worklog,
  WorklogInput,
} from '../types'
import type { LinkType } from '@/config/issueTypes'

const MAX_PAGE_SIZE = 100

export async function fetchTasks(projectId: string, params: TaskListParams) {
  const { data } = await api.get<Page<Task>>(`/projects/${projectId}/tasks`, {
    params,
    paramsSerializer: { indexes: null },
  })
  return data
}

export async function fetchAllTasks(projectId: string, params: TaskListParams = {}) {
  const first = await fetchTasks(projectId, { ...params, page: 1, page_size: MAX_PAGE_SIZE })
  const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(pageCount - 1, 0) }, (_, index) =>
      fetchTasks(projectId, { ...params, page: index + 2, page_size: MAX_PAGE_SIZE }),
    ),
  )
  return [first, ...rest].flatMap((page) => page.items)
}

export async function fetchTask(taskId: string) {
  const { data } = await api.get<Task>(`/tasks/${taskId}`)
  return data
}

export async function createTask(projectId: string, input: TaskCreateInput) {
  const { data } = await api.post<Task>(`/projects/${projectId}/tasks`, input)
  return data
}

export async function updateTask(taskId: string, input: TaskUpdateInput) {
  const { data } = await api.patch<Task>(`/tasks/${taskId}`, input)
  return data
}

export async function moveTask(taskId: string, input: TaskMoveInput) {
  const { data } = await api.patch<Task>(`/tasks/${taskId}/move`, input)
  return data
}

export async function deleteTask(taskId: string) {
  await api.delete(`/tasks/${taskId}`)
}

export async function addChecklistItem(taskId: string, text: string) {
  const { data } = await api.post<Task>(`/tasks/${taskId}/checklist`, { text })
  return data
}

export async function updateChecklistItem(
  taskId: string,
  itemId: string,
  input: { text?: string; done?: boolean },
) {
  const { data } = await api.patch<Task>(`/tasks/${taskId}/checklist/${itemId}`, input)
  return data
}

export async function deleteChecklistItem(taskId: string, itemId: string) {
  const { data } = await api.delete<Task>(`/tasks/${taskId}/checklist/${itemId}`)
  return data
}

export async function rankTask(taskId: string, input: TaskRankInput) {
  const { data } = await api.patch<Task>(`/tasks/${taskId}/rank`, input)
  return data
}

export async function setWatching(taskId: string, watching: boolean) {
  const { data } = watching
    ? await api.put<Task>(`/tasks/${taskId}/watch`)
    : await api.delete<Task>(`/tasks/${taskId}/watch`)
  return data
}

export async function fetchActivity(taskId: string) {
  const { data } = await api.get<ActivityEntry[]>(`/tasks/${taskId}/activity`)
  return data
}

export async function fetchWorklogs(taskId: string) {
  const { data } = await api.get<Worklog[]>(`/tasks/${taskId}/worklogs`)
  return data
}

export async function createWorklog(taskId: string, input: WorklogInput) {
  const { data } = await api.post<Worklog>(`/tasks/${taskId}/worklogs`, input)
  return data
}

export async function updateWorklog(worklogId: string, input: Partial<WorklogInput>) {
  const { data } = await api.patch<Worklog>(`/worklogs/${worklogId}`, input)
  return data
}

export async function deleteWorklog(worklogId: string) {
  await api.delete(`/worklogs/${worklogId}`)
}

export async function fetchLinks(taskId: string) {
  const { data } = await api.get<IssueLink[]>(`/tasks/${taskId}/links`)
  return data
}

export async function createLink(taskId: string, target: string, linkType: LinkType) {
  const { data } = await api.post<IssueLink[]>(`/tasks/${taskId}/links`, {
    target,
    link_type: linkType,
  })
  return data
}

export async function deleteLink(linkId: string) {
  await api.delete(`/links/${linkId}`)
}

export async function fetchAttachments(taskId: string) {
  const { data } = await api.get<Attachment[]>(`/tasks/${taskId}/attachments`)
  return data
}

export async function uploadAttachment(taskId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Attachment>(`/tasks/${taskId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteAttachment(attachmentId: string) {
  await api.delete(`/attachments/${attachmentId}`)
}

export async function downloadAttachment(attachment: Attachment) {
  const { data } = await api.get<Blob>(`/attachments/${attachment.id}/download`, {
    responseType: 'blob',
  })
  return data
}

export async function bulkTasks(
  projectId: string,
  taskIds: string[],
  action: { changes: TaskUpdateInput } | { delete: true },
) {
  const { data } = await api.post<BulkResult>(`/projects/${projectId}/tasks/bulk`, {
    task_ids: taskIds,
    ...action,
  })
  return data
}

export async function cloneTask(taskId: string) {
  const { data } = await api.post<Task>(`/tasks/${taskId}/clone`)
  return data
}
