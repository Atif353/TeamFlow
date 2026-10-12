import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { toApiError } from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import { changePassword } from '../api/profileApi'
import { passwordChangeSchema, type PasswordChangeInput } from '../schemas/profileSchemas'

export function PasswordForm() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordChangeInput>({ resolver: zodResolver(passwordChangeSchema) })

  const change = useMutation({
    mutationFn: (values: PasswordChangeInput) =>
      changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: ({ access_token }) => {
      setAccessToken(access_token)
      reset()
      toast.success('Password changed. Other devices were signed out.')
    },
    onError: (error) => {
      const apiError = toApiError(error)
      if (apiError.code === 'invalid_current_password') {
        setError('current_password', { message: 'Current password is incorrect' })
      } else {
        toast.error(apiError.message)
      }
    },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => change.mutate(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <PasswordInput
        label="Current password"
        autoComplete="current-password"
        error={errors.current_password?.message}
        {...register('current_password')}
      />
      <PasswordInput
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters with a letter and a number"
        error={errors.new_password?.message}
        {...register('new_password')}
      />
      <PasswordInput
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...register('confirm_password')}
      />
      <div>
        <Button type="submit" loading={change.isPending}>
          Change password
        </Button>
      </div>
    </form>
  )
}
