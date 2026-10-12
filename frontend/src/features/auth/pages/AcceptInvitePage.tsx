import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { RoleBadge } from '@/components/common/RoleBadge'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { routes } from '@/config/routes'
import { toApiError } from '@/lib/axios'
import { applyApiErrors } from '@/lib/forms'
import { PasswordInput } from '../components/PasswordInput'
import { useAcceptInvite, useInvitePreview } from '../hooks/useAuth'
import { acceptInviteSchema, type AcceptInviteInput } from '../schemas/authSchemas'

export function AcceptInvitePage() {
  const { token = '' } = useParams()
  const preview = useInvitePreview(token)
  const accept = useAcceptInvite(token)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AcceptInviteInput>({ resolver: zodResolver(acceptInviteSchema) })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    accept.mutate(values, {
      onError: (error) => setFormError(applyApiErrors(error, setError, ['name', 'password'])),
    })
  })

  if (preview.isPending) {
    return (
      <AuthLayout title="Loading invitation">
        <div className="flex flex-col gap-3" role="status" aria-label="Loading invitation">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </AuthLayout>
    )
  }

  if (preview.isError) {
    const status = toApiError(preview.error).code
    const title =
      status === 'invitation_not_found' ? 'Invitation not found' : 'Invitation unavailable'
    return (
      <AuthLayout title={title}>
        <ErrorState
          title="This link cannot be used"
          message="This invitation link is invalid, expired, already used, or was revoked. Ask your workspace admin for a new one."
        />
        <Link
          to={routes.login}
          className="mt-2 block text-center text-sm text-primary-text hover:underline"
        >
          Go to sign in
        </Link>
      </AuthLayout>
    )
  }

  const invite = preview.data
  return (
    <AuthLayout
      title={`Join ${invite.workspace_name}`}
      subtitle={
        invite.invited_by_name ? `${invite.invited_by_name} invited you.` : 'You have been invited.'
      }
    >
      <div className="mb-5 flex items-center justify-between rounded-lg bg-surface-muted p-3 text-sm">
        <span className="truncate text-muted-foreground">{invite.email}</span>
        <RoleBadge role={invite.role} />
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Full name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters with a letter and a number"
          error={errors.password?.message}
          {...register('password')}
        />
        {formError && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger-fg">
            {formError}
          </p>
        )}
        <Button type="submit" fullWidth loading={accept.isPending}>
          Accept invitation
        </Button>
      </form>
    </AuthLayout>
  )
}
