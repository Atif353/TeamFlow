import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ColorPicker } from '@/components/common/ColorPicker'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { LabelChip } from '@/components/common/LabelChip'
import { toApiError } from '@/lib/axios'
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from '../hooks/useProjects'
import { labelSchema, type LabelInput } from '../schemas/projectSchemas'
import type { Label } from '../types'

const DEFAULTS: LabelInput = { name: '', color: '#6366F1' }

export function LabelManager({ projectId }: { projectId: string }) {
  const labels = useLabels(projectId)
  const create = useCreateLabel(projectId)
  const update = useUpdateLabel(projectId)
  const remove = useDeleteLabel(projectId)
  const [editing, setEditing] = useState<Label | null>(null)
  const [deleting, setDeleting] = useState<Label | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LabelInput>({ resolver: zodResolver(labelSchema), defaultValues: DEFAULTS })

  const startEdit = (label: Label | null) => {
    setEditing(label)
    reset(label ? { name: label.name, color: label.color } : DEFAULTS)
  }

  const onSubmit = handleSubmit((values) => {
    const onError = (error: unknown) => {
      if (toApiError(error).code === 'label_name_taken') {
        setError('name', { message: 'A label with this name already exists' })
      }
    }
    if (editing) {
      update.mutate({ id: editing.id, ...values }, { onSuccess: () => startEdit(null), onError })
    } else {
      create.mutate(values, {
        onSuccess: () => {
          toast.success('Label created')
          reset(DEFAULTS)
        },
        onError,
      })
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-3 rounded-lg border border-border p-3"
      >
        <Input
          label={editing ? `Editing “${editing.name}”` : 'New label'}
          error={errors.name?.message}
          maxLength={30}
          {...register('name')}
        />
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker label="Label color" value={field.value} onChange={field.onChange} />
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" loading={create.isPending || update.isPending}>
            {editing ? (
              'Save label'
            ) : (
              <>
                <Plus size={16} aria-hidden="true" /> Add label
              </>
            )}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => startEdit(null)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
      {labels.isPending ? (
        <Skeleton className="h-10" />
      ) : labels.isError ? (
        <ErrorState onRetry={() => void labels.refetch()} />
      ) : labels.data.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No labels yet"
          description="Labels help you categorise tasks."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {labels.data.map((label) => (
            <li
              key={label.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
            >
              <LabelChip label={label} />
              <div className="flex">
                <IconButton
                  icon={Pencil}
                  label={`Edit ${label.name}`}
                  size="sm"
                  onClick={() => startEdit(label)}
                />
                <IconButton
                  icon={Trash2}
                  label={`Delete ${label.name}`}
                  size="sm"
                  onClick={() => setDeleting(label)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete label?"
        description={`“${deleting?.name ?? ''}” will be removed from every task that uses it.`}
        confirmLabel="Delete label"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Label deleted')
              setDeleting(null)
            },
          })
        }
      />
    </div>
  )
}
