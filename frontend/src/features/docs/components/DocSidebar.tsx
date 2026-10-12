import { History, Link2, RotateCcw, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { routes } from '@/config/routes'
import { formatRelative } from '@/lib/formatters'
import { useDocActions } from '../hooks/useDocs'
import type { Doc } from '../types'

interface DocSidebarProps {
  doc: Doc
  projectId: string
  canWrite: boolean
  dirty: boolean
}

export function DocSidebar({ doc, projectId, canWrite, dirty }: DocSidebarProps) {
  const { restore, link, unlink } = useDocActions(projectId)
  const [key, setKey] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = key.trim()
    if (value) link.mutate({ id: doc.id, task: value }, { onSuccess: () => setKey('') })
  }

  return (
    <aside aria-label="Document details" className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 size={16} aria-hidden="true" /> Linked issues
        </h3>
        <ul className="flex flex-col gap-1.5">
          {doc.linked_tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2 text-sm">
              <IssueTypeIcon type={task.issue_type} />
              <Link to={routes.issue(task.key)} className="min-w-0 flex-1 truncate hover:underline">
                <span className="mr-1.5 text-muted-foreground">{task.key}</span>
                {task.title}
              </Link>
              {canWrite && (
                <IconButton
                  icon={X}
                  label={`Unlink ${task.key}`}
                  size="sm"
                  onClick={() => unlink.mutate({ id: doc.id, task: task.key })}
                />
              )}
            </li>
          ))}
          {doc.linked_tasks.length === 0 && (
            <li className="text-sm text-muted-foreground">No linked issues.</li>
          )}
        </ul>
        {canWrite && (
          <form onSubmit={submit} className="flex gap-2">
            <Input
              aria-label="Issue key to link"
              placeholder="PROJ-12"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="outline" loading={link.isPending} disabled={!key.trim()}>
              Link
            </Button>
          </form>
        )}
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History size={16} aria-hidden="true" /> Version history
        </h3>
        {dirty && (
          <p className="text-xs text-warning-fg">Save your changes before restoring a version.</p>
        )}
        <ul className="flex flex-col gap-2">
          {doc.versions.map((version) => (
            <li key={version.number} className="flex items-center gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">Version {version.number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {version.saved_by?.name ?? 'Someone'} · {formatRelative(version.saved_at)}
                </p>
              </div>
              {canWrite && (
                <IconButton
                  icon={RotateCcw}
                  label={`Restore version ${version.number}`}
                  size="sm"
                  disabled={dirty}
                  onClick={() => restore.mutate({ id: doc.id, number: version.number })}
                />
              )}
            </li>
          ))}
          {doc.versions.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Versions are created each time you save.
            </li>
          )}
        </ul>
      </Card>
    </aside>
  )
}
