import { api } from '@/lib/axios'
import type { Page } from '@/types/common'
import type { Comment } from '../types'

export async function fetchComments(taskId: string) {
  const { data } = await api.get<Page<Comment>>(`/tasks/${taskId}/comments`, {
    params: { page_size: 100 },
  })
  return data
}

export async function createComment(taskId: string, body: string) {
  const { data } = await api.post<Comment>(`/tasks/${taskId}/comments`, { body })
  return data
}

export async function updateComment(commentId: string, body: string) {
  const { data } = await api.patch<Comment>(`/comments/${commentId}`, { body })
  return data
}

export async function deleteComment(commentId: string) {
  await api.delete(`/comments/${commentId}`)
}
