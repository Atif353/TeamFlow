import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/axios'
import {
  createDoc,
  deleteDoc,
  fetchDoc,
  fetchDocs,
  linkIssue,
  restoreVersion,
  unlinkIssue,
  updateDoc,
} from '../api/docsApi'
import type { Doc } from '../types'

export const docKeys = {
  list: (projectId: string, q: string) => ['docs', projectId, 'list', q] as const,
  project: (projectId: string) => ['docs', projectId] as const,
  detail: (docId: string) => ['doc', docId] as const,
}

export function useDocs(projectId: string, q: string) {
  return useQuery({ queryKey: docKeys.list(projectId, q), queryFn: () => fetchDocs(projectId, q) })
}

export function useDoc(docId: string) {
  return useQuery({ queryKey: docKeys.detail(docId), queryFn: () => fetchDoc(docId), retry: false })
}

export function useDocActions(projectId: string) {
  const client = useQueryClient()
  const store = (doc: Doc) => {
    client.setQueryData(docKeys.detail(doc.id), doc)
    void client.invalidateQueries({ queryKey: docKeys.project(projectId) })
  }
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    create: useMutation({
      mutationFn: ({ title, content }: { title: string; content: string }) =>
        createDoc(projectId, title, content),
      onSuccess: store,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string; title?: string; content?: string }) =>
        updateDoc(id, input),
      onSuccess: store,
      onError,
    }),
    remove: useMutation({
      mutationFn: deleteDoc,
      onSuccess: () => void client.invalidateQueries({ queryKey: docKeys.project(projectId) }),
      onError,
    }),
    restore: useMutation({
      mutationFn: ({ id, number }: { id: string; number: number }) => restoreVersion(id, number),
      onSuccess: store,
      onError,
    }),
    link: useMutation({
      mutationFn: ({ id, task }: { id: string; task: string }) => linkIssue(id, task),
      onSuccess: store,
      onError,
    }),
    unlink: useMutation({
      mutationFn: ({ id, task }: { id: string; task: string }) => unlinkIssue(id, task),
      onSuccess: store,
      onError,
    }),
  }
}
