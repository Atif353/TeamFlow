import { Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useComponentsUpdate } from '@/features/agile/hooks/useAgile'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Project } from '../types'

export function ComponentsManager({ project }: { project: Project }) {
  const update = useComponentsUpdate(project.id)
  const [name, setName] = useState('')

  const add = (event: FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (!value) return
    if (project.components.some((item) => item.toLowerCase() === value.toLowerCase())) return
    update.mutate([...project.components, value], { onSuccess: () => setName('') })
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={add} className="flex gap-2">
        <Input
          aria-label="New component name"
          placeholder="e.g. API, Web app, Billing"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="outline" loading={update.isPending} disabled={!name.trim()}>
          <Plus size={16} aria-hidden="true" /> Add
        </Button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {project.components.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted py-1 pl-3 pr-1 text-sm"
          >
            {item}
            <button
              type="button"
              aria-label={`Remove component ${item}`}
              onClick={() => update.mutate(project.components.filter((entry) => entry !== item))}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-border"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
        {project.components.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Components group issues by area of the product.
          </li>
        )}
      </ul>
    </div>
  )
}
