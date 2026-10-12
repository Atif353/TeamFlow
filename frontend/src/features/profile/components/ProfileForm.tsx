import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { errorMessage } from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '../api/profileApi'
import { profileSchema, type ProfileInput } from '../schemas/profileSchemas'

export function ProfileForm() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const save = useMutation({
    mutationFn: (values: ProfileInput) => updateProfile(values.name),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Profile updated')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '' },
  })

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Input label="Display name" error={errors.name?.message} {...register('name')} />
      <Input
        label="Email"
        value={user?.email ?? ''}
        readOnly
        disabled
        hint="Your email cannot be changed."
      />
      <div>
        <Button type="submit" disabled={!isDirty} loading={save.isPending}>
          Save profile
        </Button>
      </div>
    </form>
  )
}
