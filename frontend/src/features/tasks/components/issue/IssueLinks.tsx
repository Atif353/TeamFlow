import { Link2, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LINK_TYPE_LABELS, type LinkType } from '@/config/issueTypes'
import { routes } from '@/config/routes'
import { cn } from '@/lib/cn'
import { useLinkActions, useLinks } from '../../hooks/useIssueWork'

interface IssueLinksProps {
  taskId: string
  projectId: string
  canEdit: boolean
}

export function IssueLinks({ taskId, projectId, canEdit }: IssueLinksProps) {
  const links = useLinks(taskId)
  const { add, remove } = useLinkActions(projectId, taskId)
  const [adding, setAdding] = useState(false)
  const [linkType, setLinkType] = useState<LinkType>('blocks')
  const [target, setTarget] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const key = target.trim()
    if (!key) return
    add.mutate(
      { target: key, linkType },
      {
        onSuccess: () => {
          setTarget('')
          setAdding(false)
        },
      },
    )
  }

  const items = links.data ?? []
  if (!canEdit && items.length === 0) return null

  return (
    <section aria-labelledby="links-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 id="links-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Link2 size={16} aria-hidden="true" /> Linked issues
        </h4>
        {canEdit && !adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" /> Link issue
          </Button>
        )}
      </div>
      {adding && (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Select
            label="Relationship"
            value={linkType}
            onChange={(event) => setLinkType(event.target.value as LinkType)}
            options={(Object.keys(LINK_TYPE_LABELS) as LinkType[]).map((type) => ({
              value: type,
              label: LINK_TYPE_LABELS[type],
            }))}
          />
          <Input
            label="Issue key"
            placeholder="PROJ-12"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={add.isPending} disabled={!target.trim()}>
              Link
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {items.map((link) => (
          <li key={link.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{link.label}</span>
            <IssueTypeIcon type={link.issue.issue_type} />
            <Link
              to={routes.issue(link.issue.key)}
              className={cn(
                'min-w-0 flex-1 truncate text-sm hover:underline',
                link.issue.done && 'text-muted-foreground line-through',
              )}
            >
              <span className="mr-2 font-medium text-muted-foreground">{link.issue.key}</span>
              {link.issue.title}
            </Link>
            {canEdit && (
              <IconButton
                icon={X}
                label={`Remove link to ${link.issue.key}`}
                size="sm"
                onClick={() => remove.mutate(link.id)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
