import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { formatRelative } from '@/lib/formatters'
import type { Comment, MentionCandidate } from '../types'
import { CommentBody } from './CommentBody'
import { MentionTextarea } from './MentionTextarea'

interface CommentItemProps {
  comment: Comment
  canEdit: boolean
  canDelete: boolean
  candidates: (MentionCandidate & { avatar_color: string })[]
  saving: boolean
  onSave: (body: string) => void
  onDelete: () => void
}

export function CommentItem({
  comment,
  canEdit,
  canDelete,
  candidates,
  saving,
  onSave,
  onDelete,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const author = comment.author

  const save = () => {
    if (!draft.trim()) return
    onSave(draft.trim())
    setEditing(false)
  }

  return (
    <li className="flex gap-3">
      <Avatar
        name={author?.name ?? 'Unknown'}
        color={author?.avatar_color ?? '#64748B'}
        inactive={author ? !author.is_active : false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="text-sm font-medium text-foreground">
            {author?.name ?? 'Unknown user'}
          </span>
          {author && !author.is_active && <span>(deactivated)</span>}
          <time dateTime={comment.created_at}>{formatRelative(comment.created_at)}</time>
          {comment.edited_at && <span>(edited)</span>}
        </div>
        {editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <MentionTextarea
              label="Edit comment"
              value={draft}
              onChange={setDraft}
              candidates={candidates}
              onSubmit={save}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} loading={saving}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.body)
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <CommentBody
            body={comment.body}
            mentionNames={comment.mentions.map((user) => user.name)}
          />
        )}
      </div>
      {!editing && (canEdit || canDelete) && (
        <div className="flex shrink-0 items-start">
          {canEdit && (
            <IconButton
              icon={Pencil}
              label="Edit comment"
              size="sm"
              onClick={() => setEditing(true)}
            />
          )}
          {canDelete && (
            <IconButton icon={Trash2} label="Delete comment" size="sm" onClick={onDelete} />
          )}
        </div>
      )}
    </li>
  )
}
