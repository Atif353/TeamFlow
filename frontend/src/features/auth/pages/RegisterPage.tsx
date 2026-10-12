import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { routes } from '@/config/routes'
import { toApiError } from '@/lib/axios'
import { applyApiErrors } from '@/lib/forms'
import { PasswordInput } from '../components/PasswordInput'
import { useRegister } from '../hooks/useAuth'
import { registerSchema, type RegisterInput } from '../schemas/authSchemas'

const FIELDS = ['name', 'email', 'password', 'workspace_name'] as const

export function RegisterPage() {
  const registration = useRegister()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    registration.mutate(values, {
      onSuccess: (result) =>
        navigate(routes.verifyEmail, { state: { email: result.email, devCode: result.dev_code } }),
      onError: (error) => {
        if (toApiError(error).code === 'email_taken') {
          setError('email', { message: 'This email is already registered' })
          return
        }
        setFormError(applyApiErrors(error, setError, FIELDS))
      },
    })
  })

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="You become the Super Admin and can invite your team."
      footer={
        <>
          Already have an account?{' '}
          <Link to={routes.login} className="font-medium text-primary-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Full name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Workspace name (optional)"
          error={errors.workspace_name?.message}
          {...register('workspace_name')}
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
        <Button type="submit" fullWidth loading={registration.isPending}>
          Create workspace
        </Button>
      </form>
    </AuthLayout>
  )
}
