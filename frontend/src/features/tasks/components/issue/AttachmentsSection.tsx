import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { errorMessage } from '@/lib/axios'
import { formatDate } from '@/lib/formatters'
import { downloadAttachment } from '../../api/tasksApi'
import { useAttachmentActions, useAttachments } from '../../hooks/useIssueWork'
import type { Attachment } from '../../types'

interface AttachmentsSectionProps {
  taskId: string
  projectId: string
  canUpload: boolean
  canManage: (attachment: Attachment) => boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function save(attachment: Attachment) {
  try {
    const blob = await downloadAttachment(attachment)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = attachment.filename
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

export function AttachmentsSection({
  taskId,
  projectId,
  canUpload,
  canManage,
}: AttachmentsSectionProps) {
  const attachments = useAttachments(taskId)
  const { upload, remove } = useAttachmentActions(projectId, taskId)
  const input = useRef<HTMLInputElement>(null)
  const items = attachments.data ?? []
  if (!canUpload && items.length === 0) return null

  return (
    <section aria-labelledby="attachments-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 id="attachments-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip size={16} aria-hidden="true" /> Attachments
          {items.length > 0 && <span className="text-muted-foreground">{items.length}</span>}
        </h4>
        {canUpload && (
          <>
            <input
              ref={input}
              type="file"
              aria-label="Attach a file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload.mutate(file, { onSuccess: () => toast.success('File attached') })
                event.target.value = ''
              }}
            />
            <Button
              size="sm"
              variant="outline"
              loading={upload.isPending}
              onClick={() => input.current?.click()}
            >
              <Upload size={14} aria-hidden="true" /> Attach
            </Button>
          </>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {items.map((attachment) => (
          <li key={attachment.id} className="flex items-center gap-3 px-3 py-2">
            <FileText size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{attachment.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(attachment.size)} · {attachment.uploaded_by?.name ?? 'Unknown'} ·{' '}
                {formatDate(attachment.created_at)}
              </p>
            </div>
            <IconButton
              icon={Download}
              label={`Download ${attachment.filename}`}
              size="sm"
              onClick={() => void save(attachment)}
            />
            {canManage(attachment) && (
              <IconButton
                icon={Trash2}
                label={`Delete ${attachment.filename}`}
                size="sm"
                onClick={() => remove.mutate(attachment.id)}
              />
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No attachments. Files up to 10 MB are supported.
        </p>
      )}
    </section>
  )
}
