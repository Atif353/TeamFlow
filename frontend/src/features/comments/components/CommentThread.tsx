import { MessageSquare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { can } from '@/config/roles'
import { useProjectMembers } from '@/features/projects'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types/common'
import { useCommentMutations, useComments } from '../hooks/useComments'
import { CommentItem } from './CommentItem'
import { MentionTextarea } from './MentionTextarea'

interface CommentThreadProps {
  taskId: string
  projectId: string
  projectRole: Role
}

export function CommentThread({ taskId, projectId, projectRole }: CommentThreadProps) {
  const userId = useAuthStore((state) => state.user?.id)
  const comments = useComments(taskId)
  const members = useProjectMembers(projectId)
  const { create, update, remove } = useCommentMutations(taskId)
  const [draft, setDraft] = useState('')
  const canComment = can(projectRole, 'comment:create')
  const canModerate = can(projectRole, 'comment:delete_any')
  const candidates = useMemo(
    () =>
      (members.data?.items ?? [])
        .filter((member) => member.is_active)
        .map((member) => ({
          id: member.user_id,
          name: member.name,
          avatar_color: member.avatar_color,
        })),
    [members.data],
  )

  const submit = () => {
    const body = draft.trim()
    if (!body) return
    create.mutate(body, { onSuccess: () => setDraft('') })
  }

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-4">
      <h3 id="comments-heading" className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare size={16} aria-hidden="true" /> Comments
        {comments.data && <span className="text-muted-foreground">({comments.data.total})</span>}
      </h3>
      {comments.isPending ? (
        <SkeletonList rows={2} />
      ) : comments.isError ? (
        <ErrorState onRetry={() => void comments.refetch()} />
      ) : comments.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.data.items.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canEdit={canComment && comment.author?.id === userId}
              canDelete={canModerate || (canComment && comment.author?.id === userId)}
              candidates={candidates}
              saving={update.isPending}
              onSave={(body) => update.mutate({ id: comment.id, body })}
              onDelete={() => remove.mutate(comment.id)}
            />
          ))}
        </ul>
      )}
      {canComment ? (
        <div className="flex flex-col gap-2">
          <MentionTextarea
            label="Write a comment"
            placeholder="Write a comment… use @ to mention a teammate"
            value={draft}
            onChange={setDraft}
            candidates={candidates}
            onSubmit={submit}
          />
          <div>
            <Button onClick={submit} disabled={!draft.trim()} loading={create.isPending}>
              Comment
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Viewers can read comments but cannot post.</p>
      )}
    </section>
  )
}
