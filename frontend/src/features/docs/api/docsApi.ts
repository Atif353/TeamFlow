import { api } from '@/lib/axios'
import type { Page } from '@/types/common'
import type { Doc, DocSummary } from '../types'

export async function fetchDocs(projectId: string, q: string) {
  const { data } = await api.get<Page<DocSummary>>(`/projects/${projectId}/docs`, {
    params: { q: q || undefined, page_size: 100 },
  })
  return data
}

export async function fetchDoc(docId: string) {
  const { data } = await api.get<Doc>(`/docs/${docId}`)
  return data
}

export async function createDoc(projectId: string, title: string, content: string) {
  const { data } = await api.post<Doc>(`/projects/${projectId}/docs`, { title, content })
  return data
}

export async function updateDoc(docId: string, input: { title?: string; content?: string }) {
  const { data } = await api.patch<Doc>(`/docs/${docId}`, input)
  return data
}

export async function deleteDoc(docId: string) {
  await api.delete(`/docs/${docId}`)
}

export async function restoreVersion(docId: string, number: number) {
  const { data } = await api.post<Doc>(`/docs/${docId}/versions/${number}/restore`)
  return data
}

export async function linkIssue(docId: string, task: string) {
  const { data } = await api.post<Doc>(`/docs/${docId}/links`, { task })
  return data
}

export async function unlinkIssue(docId: string, task: string) {
  const { data } = await api.delete<Doc>(`/docs/${docId}/links/${task}`)
  return data
}
