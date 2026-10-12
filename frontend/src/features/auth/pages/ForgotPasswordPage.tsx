import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { routes } from '@/config/routes'
import { errorMessage } from '@/lib/axios'
import { forgotPassword } from '../api/authApi'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas/authSchemas'

export function ForgotPasswordPage() {
  const request = useMutation({
    mutationFn: (input: ForgotPasswordInput) => forgotPassword(input.email),
  })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link."
      footer={
        <Link to={routes.login} className="font-medium text-primary-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      {request.isSuccess ? (
        <div role="status" className="flex flex-col gap-3 text-sm">
          <p className="rounded-lg bg-success/10 p-3 text-success-fg">{request.data.message}</p>
          {request.data.reset_url && (
            <p className="break-all rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">
              Development mode — reset link:{' '}
              <a href={request.data.reset_url} className="text-primary-text underline">
                {request.data.reset_url}
              </a>
            </p>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit((values) => request.mutate(values))}
          noValidate
          className="flex flex-col gap-4"
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          {request.isError && (
            <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger-fg">
              {errorMessage(request.error)}
            </p>
          )}
          <Button type="submit" fullWidth loading={request.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
