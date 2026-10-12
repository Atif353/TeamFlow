import { Bookmark, Save, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useSavedFilterActions, useSavedFilters } from '@/features/agile/hooks/useAgile'
import type { SavedFilter } from '@/features/agile/types'

interface SavedFiltersProps {
  projectId: string
  current: Record<string, string>
  canSave: boolean
  onApply: (params: Record<string, string>) => void
}

export function SavedFilters({ projectId, current, canSave, onApply }: SavedFiltersProps) {
  const filters = useSavedFilters(projectId)
  const { create, remove } = useSavedFilterActions(projectId)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [listing, setListing] = useState(false)
  const items: SavedFilter[] = filters.data ?? []

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (!value) return
    create.mutate(
      { name: value, params: current },
      {
        onSuccess: () => {
          toast.success('Filter saved')
          setName('')
          setNaming(false)
        },
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        aria-expanded={listing}
        onClick={() => setListing((value) => !value)}
      >
        <Bookmark size={16} aria-hidden="true" /> Saved filters
        {items.length > 0 && <span className="text-muted-foreground">{items.length}</span>}
      </Button>
      {canSave && (
        <Button variant="outline" onClick={() => setNaming(true)}>
          <Save size={16} aria-hidden="true" /> Save filter
        </Button>
      )}
      {listing && (
        <ul
          aria-label="Saved filters"
          className="flex w-full flex-wrap gap-2 rounded-lg border border-border p-2"
        >
          {items.map((item) => (
            <li
              key={item.id}
              className="inline-flex items-center rounded-full bg-surface-muted pl-3 text-sm"
            >
              <button
                type="button"
                onClick={() => onApply(item.params)}
                className="min-h-[36px] pr-2 hover:underline"
              >
                {item.name}
              </button>
              <IconButton
                icon={Trash2}
                label={`Delete filter ${item.name}`}
                size="sm"
                onClick={() => remove.mutate(item.id)}
              />
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-2 text-sm text-muted-foreground">
              Apply some filters, then choose “Save filter” to keep them.
            </li>
          )}
        </ul>
      )}
      <Modal
        open={naming}
        onClose={() => setNaming(false)}
        title="Save filter"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setNaming(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="save-filter-form"
              loading={create.isPending}
              disabled={!name.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <form id="save-filter-form" onSubmit={submit}>
          <Input
            label="Filter name"
            data-autofocus
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
        </form>
      </Modal>
    </div>
  )
}
