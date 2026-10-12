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
import { useLogin } from '../hooks/useAuth'
import { loginSchema, type LoginInput } from '../schemas/authSchemas'

export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    login.mutate(values, {
      onError: (error) => {
        if (toApiError(error).code === 'email_not_verified') {
          navigate(routes.verifyEmail, { state: { email: values.email, resend: true } })
          return
        }
        setFormError(applyApiErrors(error, setError, ['email', 'password']))
      },
    })
  })

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your workspace."
      footer={
        <>
          New to TeamFlow?{' '}
          <Link to={routes.register} className="font-medium text-primary-text hover:underline">
            Create a workspace
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Link
          to={routes.forgotPassword}
          className="self-end text-sm font-medium text-primary-text hover:underline"
        >
          Forgot your password?
        </Link>
        {formError && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger-fg">
            {formError}
          </p>
        )}
        <Button type="submit" fullWidth loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
