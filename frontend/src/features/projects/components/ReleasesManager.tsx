import { PackageCheck, Plus, Rocket, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ProgressBar } from '@/components/common/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { useVersionActions, useVersions } from '@/features/agile/hooks/useAgile'
import { formatDate, percent } from '@/lib/formatters'

export function ReleasesManager({ projectId }: { projectId: string }) {
  const versions = useVersions(projectId)
  const { create, update, remove } = useVersionActions(projectId)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (!value) return
    create.mutate(
      { name: value, release_date: date || null },
      {
        onSuccess: () => {
          setName('')
          setDate('')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <Input
          label="Release name"
          placeholder="v1.0"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Release date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          <Plus size={16} aria-hidden="true" /> Add release
        </Button>
      </form>
      <ul className="flex flex-col gap-3">
        {(versions.data ?? []).map((version) => (
          <li key={version.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Rocket size={16} aria-hidden="true" />
              <span className="font-medium">{version.name}</span>
              <Badge tone={version.released ? 'success' : 'neutral'}>
                {version.released ? 'Released' : 'Unreleased'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {version.release_date ? `Due ${formatDate(version.release_date)}` : 'No date'}
              </span>
              <span className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update.mutate({ id: version.id, input: { released: !version.released } })
                  }
                >
                  <PackageCheck size={14} aria-hidden="true" />
                  {version.released ? 'Mark unreleased' : 'Release'}
                </Button>
                <IconButton
                  icon={Trash2}
                  label={`Delete ${version.name}`}
                  size="sm"
                  onClick={() => remove.mutate(version.id)}
                />
              </span>
            </div>
            <ProgressBar
              value={percent(version.done_count, version.issue_count)}
              label={`${version.name} progress`}
            />
            <p className="text-xs text-muted-foreground">
              {version.done_count} of {version.issue_count} issues done
            </p>
          </li>
        ))}
        {versions.data?.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Releases collect issues that ship together. Assign a fix version on any issue.
          </li>
        )}
      </ul>
    </div>
  )
}
