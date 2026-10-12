import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/axios'
import { createComment, deleteComment, fetchComments, updateComment } from '../api/commentsApi'

const commentKeys = {
  task: (taskId: string) => ['comments', taskId] as const,
}

export function useComments(taskId: string) {
  return useQuery({ queryKey: commentKeys.task(taskId), queryFn: () => fetchComments(taskId) })
}

export function useCommentMutations(taskId: string) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: commentKeys.task(taskId) })
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    create: useMutation({
      mutationFn: (body: string) => createComment(taskId, body),
      onSuccess: refresh,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: string }) => updateComment(id, body),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({ mutationFn: deleteComment, onSuccess: refresh, onError }),
  }
}
