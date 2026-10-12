import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ColorPicker } from '@/components/common/ColorPicker'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useUpdateProject } from '../hooks/useProjects'
import { projectEditSchema, type ProjectEditInput } from '../schemas/projectSchemas'
import type { Project } from '../types'

export function ProjectDetailsForm({ project }: { project: Project }) {
  const update = useUpdateProject(project.id)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProjectEditInput>({
    resolver: zodResolver(projectEditSchema),
    defaultValues: { name: project.name, description: project.description, color: project.color },
  })

  const onSubmit = handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => {
        reset(values)
        toast.success('Project details saved')
      },
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input label="Name" error={errors.name?.message} {...register('name')} />
      <Input label="Key" value={project.key} disabled readOnly hint="The key cannot be changed." />
      <Textarea
        label="Description"
        rows={3}
        error={errors.description?.message}
        {...register('description')}
      />
      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <ColorPicker label="Project color" value={field.value} onChange={field.onChange} />
        )}
      />
      <div>
        <Button type="submit" disabled={!isDirty} loading={update.isPending}>
          Save details
        </Button>
      </div>
    </form>
  )
}
