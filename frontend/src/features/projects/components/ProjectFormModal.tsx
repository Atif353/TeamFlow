import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ColorPicker } from '@/components/common/ColorPicker'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { toApiError } from '@/lib/axios'
import { applyApiErrors } from '@/lib/forms'
import { useCreateProject, useUpdateProject } from '../hooks/useProjects'
import { projectSchema, type ProjectInput } from '../schemas/projectSchemas'
import type { Project } from '../types'

interface ProjectFormModalProps {
  open: boolean
  onClose: () => void
  project?: Project
}

const DEFAULTS: ProjectInput = { name: '', key: '', description: '', color: '#6366F1' }
const FIELDS = ['name', 'key', 'description', 'color'] as const

export function ProjectFormModal({ open, onClose, project }: ProjectFormModalProps) {
  const isEdit = Boolean(project)
  const create = useCreateProject()
  const update = useUpdateProject(project?.id ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProjectInput>({ resolver: zodResolver(projectSchema), defaultValues: DEFAULTS })

  useEffect(() => {
    if (open) {
      reset(
        project
          ? {
              name: project.name,
              key: project.key,
              description: project.description,
              color: project.color,
            }
          : DEFAULTS,
      )
    }
  }, [open, project, reset])

  const close = () => {
    setFormError(null)
    onClose()
  }

  const onSuccess = (message: string) => {
    toast.success(message)
    close()
  }

  const onError = (error: unknown) => {
    if (toApiError(error).code === 'project_key_taken') {
      setError('key', { message: 'This key is already used in your workspace' })
      return
    }
    setFormError(applyApiErrors(error, setError, FIELDS))
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (project) {
      update.mutate(
        { name: values.name, description: values.description, color: values.color },
        { onSuccess: () => onSuccess('Project updated'), onError },
      )
    } else {
      create.mutate(values, { onSuccess: () => onSuccess('Project created'), onError })
    }
  })

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Edit project' : 'New project'}
      description={isEdit ? undefined : 'Projects hold the tasks for one piece of work.'}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" loading={create.isPending || update.isPending}>
            {isEdit ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Name" data-autofocus error={errors.name?.message} {...register('name')} />
        <Input
          label="Key"
          disabled={isEdit}
          hint="Short unique code, e.g. APOLLO"
          error={errors.key?.message}
          {...register('key')}
        />
        <Textarea
          label="Description"
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Color</span>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <ColorPicker label="Project color" value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
        {formError && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger-fg">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  )
}
