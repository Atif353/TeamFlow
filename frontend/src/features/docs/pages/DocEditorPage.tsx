import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { SkeletonList } from '@/components/ui/Skeleton'
import { can } from '@/config/roles'
import { routes } from '@/config/routes'
import { useProject } from '@/features/projects'
import { DocSidebar } from '../components/DocSidebar'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { useDoc, useDocActions } from '../hooks/useDocs'
import type { Doc } from '../types'

interface EditorBodyProps {
  doc: Doc
  projectId: string
  canWrite: boolean
  canDelete: boolean
}

function EditorBody({ doc, projectId, canWrite, canDelete }: EditorBodyProps) {
  const navigate = useNavigate()
  const { update, remove } = useDocActions(projectId)
  const [title, setTitle] = useState(doc.title)
  const [content, setContent] = useState(doc.content)
  const [confirming, setConfirming] = useState(false)
  const dirty = title.trim() !== doc.title || content !== doc.content

  const save = () => {
    if (!title.trim()) return toast.error('A title is required')
    update.mutate(
      { id: doc.id, title: title.trim(), content },
      { onSuccess: () => toast.success('Document saved') },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={routes.docs(projectId)}
          className="inline-flex items-center gap-1 text-sm text-primary-text hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" /> All docs
        </Link>
        <div className="flex gap-2">
          {canDelete && (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </Button>
          )}
          {canWrite && (
            <Button onClick={save} loading={update.isPending} disabled={!dirty}>
              <Save size={16} aria-hidden="true" /> {dirty ? 'Save' : 'Saved'}
            </Button>
          )}
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-3">
          <Input
            aria-label="Document title"
            value={title}
            maxLength={120}
            disabled={!canWrite}
            onChange={(event) => setTitle(event.target.value)}
            className="[&_input]:text-xl [&_input]:font-semibold"
          />
          <RichTextEditor content={doc.content} editable={canWrite} onChange={setContent} />
        </div>
        <DocSidebar doc={doc} projectId={projectId} canWrite={canWrite} dirty={dirty} />
      </div>
      <ConfirmDialog
        open={confirming}
        title="Delete document?"
        description={`“${doc.title}” and all of its versions will be permanently deleted.`}
        confirmLabel="Delete document"
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(doc.id, {
            onSuccess: () => {
              toast.success('Document deleted')
              navigate(routes.docs(projectId), { replace: true })
            },
          })
        }
      />
    </div>
  )
}

export function DocEditorPage() {
  const { projectId = '', docId = '' } = useParams()
  const project = useProject(projectId)
  const doc = useDoc(docId)

  if (doc.isError || project.isError) {
    return <ErrorState title="Document not found" onRetry={() => void doc.refetch()} />
  }
  if (doc.isPending || project.isPending) return <SkeletonList rows={5} />

  const role = project.data.my_role
  return (
    <EditorBody
      key={`${doc.data.id}-${doc.data.versions.length}-${doc.data.updated_at}`}
      doc={doc.data}
      projectId={projectId}
      canWrite={can(role, 'doc:write')}
      canDelete={can(role, 'task:delete_any')}
    />
  )
}
