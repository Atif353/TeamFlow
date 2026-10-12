import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { ROLES, ROLE_LABELS } from '@/config/roles'
import { emailSchema } from '@/features/auth/schemas/authSchemas'
import { toApiError } from '@/lib/axios'
import type { Role } from '@/types/common'
import { useCreateInvitation } from '../hooks/useAdmin'
import type { InvitationCreated } from '../types'

const schema = z.object({
  email: emailSchema,
  role: z.enum(['super_admin', 'project_manager', 'member', 'viewer']),
})
type FormValues = z.infer<typeof schema>

interface CreateInvitationModalProps {
  open: boolean
  onClose: () => void
  onCreated: (invitation: InvitationCreated) => void
}

export function CreateInvitationModal({ open, onClose, onCreated }: CreateInvitationModalProps) {
  const create = useCreateInvitation()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  })

  useEffect(() => {
    if (open) reset({ email: '', role: 'member' })
  }, [open, reset])

  const onSubmit = handleSubmit((values) =>
    create.mutate(
      { email: values.email, role: values.role as Role },
      {
        onSuccess: (invitation) => {
          onClose()
          onCreated(invitation)
        },
        onError: (error) => {
          const apiError = toApiError(error)
          setError('email', {
            message:
              apiError.code === 'email_taken'
                ? 'A user with this email already exists'
                : apiError.message,
          })
        },
      },
    ),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a teammate"
      description="They will join your workspace with the role you choose."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={create.isPending}>
            Create invitation
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          data-autofocus
          error={errors.email?.message}
          {...register('email')}
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
