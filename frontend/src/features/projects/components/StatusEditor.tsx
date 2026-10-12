import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { toApiError } from '@/lib/axios'
import { useUpdateStatuses } from '../hooks/useProjects'
import type { Project, StatusInput } from '../types'

interface DraftStatus extends StatusInput {
  draftKey: string
}

const MAX_STATUSES = 20

function toDrafts(project: Project): DraftStatus[] {
  return [...project.statuses]
    .sort((a, b) => a.order - b.order)
    .map((status) => ({
      draftKey: status.id,
      id: status.id,
      name: status.name,
      color: status.color,
      is_done: status.is_done,
      wip_limit: status.wip_limit,
    }))
}

export function StatusEditor({ project }: { project: Project }) {
  const [drafts, setDrafts] = useState<DraftStatus[]>(() => toDrafts(project))
  const [error, setError] = useState<string | null>(null)
  const save = useUpdateStatuses(project.id)

  const patch = (index: number, changes: Partial<DraftStatus>) =>
    setDrafts((items) =>
      items.map((item, position) => (position === index ? { ...item, ...changes } : item)),
    )

  const move = (index: number, offset: number) =>
    setDrafts((items) => {
      const target = index + offset
      if (target < 0 || target >= items.length) return items
      const next = [...items]
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(target, 0, moved)
      return next
    })

  const addStatus = () =>
    setDrafts((items) => [
      ...items,
      {
        draftKey: crypto.randomUUID(),
        name: '',
        color: '#64748B',
        is_done: false,
        wip_limit: null,
      },
    ])

  const names = drafts.map((draft) => draft.name.trim().toLowerCase())
  const invalid = drafts.some((draft) => !draft.name.trim()) || new Set(names).size !== names.length

  const onSave = () => {
    setError(null)
    save.mutate(
      drafts.map(({ id, name, color, is_done, wip_limit }) => ({
        id,
        name: name.trim(),
        color,
        is_done,
        wip_limit,
      })),
      {
        onSuccess: (updated) => {
          setDrafts(toDrafts(updated))
          toast.success('Statuses saved')
        },
        onError: (failure) => {
          const apiError = toApiError(failure)
          if (apiError.code === 'status_has_tasks') {
            setError(
              'A status you removed still has tasks. Move those tasks to another status first.',
            )
          }
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {drafts.map((draft, index) => (
          <li
            key={draft.draftKey}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 sm:flex-nowrap"
          >
            <input
              type="color"
              aria-label={`Color for status ${index + 1}`}
              value={draft.color}
              onChange={(event) => patch(index, { color: event.target.value.toUpperCase() })}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
            />
            <Input
              aria-label={`Name of status ${index + 1}`}
              value={draft.name}
              maxLength={40}
              onChange={(event) => patch(index, { name: event.target.value })}
              className="min-w-0 flex-1"
            />
            <Input
              type="number"
              min={1}
              max={999}
              aria-label={`WIP limit of status ${index + 1}`}
              placeholder="WIP limit"
              value={draft.wip_limit ?? ''}
              onChange={(event) =>
                patch(index, { wip_limit: event.target.value ? Number(event.target.value) : null })
              }
              className="w-28"
            />
            <Checkbox
              label="Counts as done"
              checked={draft.is_done}
              onChange={(event) => patch(index, { is_done: event.target.checked })}
            />
            <div className="ml-auto flex items-center">
              <IconButton
                icon={ArrowUp}
                label={`Move ${draft.name || 'status'} up`}
                size="sm"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              />
              <IconButton
                icon={ArrowDown}
                label={`Move ${draft.name || 'status'} down`}
                size="sm"
                disabled={index === drafts.length - 1}
                onClick={() => move(index, 1)}
              />
              <IconButton
                icon={Trash2}
                label={`Delete ${draft.name || 'status'}`}
                size="sm"
                disabled={drafts.length === 1}
                onClick={() =>
                  setDrafts((items) => items.filter((_, position) => position !== index))
                }
              />
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger-fg">
          {error}
        </p>
      )}
      {invalid && (
        <p className="text-xs text-muted-foreground">
          Every status needs a unique, non-empty name.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={addStatus} disabled={drafts.length >= MAX_STATUSES}>
          <Plus size={16} aria-hidden="true" /> Add status
        </Button>
        <Button onClick={onSave} disabled={invalid} loading={save.isPending}>
          Save statuses
        </Button>
        <Button variant="ghost" onClick={() => setDrafts(toDrafts(project))}>
          Reset
        </Button>
      </div>
    </div>
  )
}
