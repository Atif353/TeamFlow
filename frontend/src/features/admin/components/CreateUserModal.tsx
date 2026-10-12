import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { emailSchema, nameSchema, passwordSchema } from '@/features/auth/schemas/authSchemas'
import { ROLES, ROLE_LABELS } from '@/config/roles'
import { applyApiErrors } from '@/lib/forms'
import { useCreateAdminUser } from '../hooks/useAdmin'

const schema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['super_admin', 'project_manager', 'member', 'viewer']),
})

type FormValues = z.infer<typeof schema>

const DEFAULTS: FormValues = { name: '', email: '', password: '', role: 'member' }

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onCreated: (userId: string) => void
}

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const create = useCreateAdminUser()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS })

  useEffect(() => {
    if (open) reset(DEFAULTS)
  }, [open, reset])

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (user) => {
        toast.success(`${user.name} can now sign in`)
        onClose()
        onCreated(user.id)
      },
      onError: (error) => {
        const message = applyApiErrors(error, setError, ['name', 'email', 'password'])
        if (message) toast.error(message)
      },
    }),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create user"
      description="Create an account directly. Share the password with the user securely."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" loading={create.isPending}>
            Create user
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Full name"
          data-autofocus
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Initial password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Select
          label="Role"
          options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          {...register('role')}
        />
      </form>
    </Modal>
  )
}
