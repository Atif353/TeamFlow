import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { routes } from '@/config/routes'
import { errorMessage } from '@/lib/axios'
import { resetPassword } from '../api/authApi'
import { PasswordInput } from '../components/PasswordInput'
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas/authSchemas'

export function ResetPasswordPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const reset = useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPassword(token, input.password),
    onSuccess: () => {
      toast.success('Password updated. Sign in with your new password.')
      navigate(routes.login, { replace: true })
    },
  })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) })

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Use at least 8 characters with a letter and a number."
      footer={
        <Link to={routes.login} className="font-medium text-primary-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={handleSubmit((values) => reset.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {reset.isError && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger-fg">
            {errorMessage(reset.error)}
          </p>
        )}
        <Button type="submit" fullWidth loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
