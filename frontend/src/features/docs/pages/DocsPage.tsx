import { BookOpen, FileText, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { SkeletonList } from '@/components/ui/Skeleton'
import { can } from '@/config/roles'
import { routes } from '@/config/routes'
import { useProject } from '@/features/projects'
import { useDebounce } from '@/hooks/useDebounce'
import { formatRelative } from '@/lib/formatters'
import { useDocActions, useDocs } from '../hooks/useDocs'

export function DocsPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const project = useProject(projectId)
  const [text, setText] = useState('')
  const query = useDebounce(text, 300)
  const docs = useDocs(projectId, query)
  const { create } = useDocActions(projectId)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const canWrite = project.data ? can(project.data.my_role, 'doc:write') : false

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = title.trim()
    if (!value) return
    create.mutate(
      { title: value, content: '' },
      {
        onSuccess: (doc) => {
          setCreating(false)
          setTitle('')
          navigate(routes.doc(projectId, doc.id))
        },
      },
    )
  }

  if (docs.isError) return <ErrorState onRetry={() => void docs.refetch()} />

  return (
    <section aria-label="Docs" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={text}
          onChange={setText}
          placeholder="Search docs"
          ariaLabel="Search docs"
          className="w-full sm:w-64"
        />
        {canWrite && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> New doc
          </Button>
        )}
      </div>
      {docs.isPending ? (
        <SkeletonList rows={4} />
      ) : docs.data.items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={query ? 'No docs match your search' : 'No docs yet'}
          description="Write specs, meeting notes and decisions, and link them to issues."
          action={
            canWrite && !query ? (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} aria-hidden="true" /> New doc
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {docs.data.items.map((doc) => (
            <li key={doc.id}>
              <Link to={routes.doc(projectId, doc.id)} className="block">
                <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-surface-muted/50">
                  <span className="flex items-center gap-2 font-medium">
                    <FileText size={16} className="shrink-0 text-primary-text" aria-hidden="true" />
                    <span className="truncate">{doc.title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatRelative(doc.updated_at)}
                    {doc.updated_by ? ` by ${doc.updated_by.name}` : ''} · {doc.version_count}{' '}
                    {doc.version_count === 1 ? 'version' : 'versions'}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New doc"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="new-doc-form"
              loading={create.isPending}
              disabled={!title.trim()}
            >
              Create doc
            </Button>
          </>
        }
      >
        <form id="new-doc-form" onSubmit={submit}>
          <Input
            label="Title"
            data-autofocus
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
        </form>
      </Modal>
    </section>
  )
}
