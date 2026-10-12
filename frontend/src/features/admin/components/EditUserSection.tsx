import { KeyRound, Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { emailSchema, nameSchema, passwordSchema } from '@/features/auth/schemas/authSchemas'
import { errorMessage } from '@/lib/axios'
import { useUserAdminActions } from '../hooks/useAdmin'
import type { AdminUserDetail } from '../types'

export function EditUserSection({ user }: { user: AdminUserDetail }) {
  const actions = useUserAdminActions(user.id)
  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()

  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    const parsedName = nameSchema.safeParse(name)
    const parsedEmail = emailSchema.safeParse(email)
    if (!parsedName.success) return setError(parsedName.error.issues[0]?.message)
    if (!parsedEmail.success) return setError(parsedEmail.error.issues[0]?.message)
    setError(undefined)
    actions.updateProfile.mutate(
      { name: parsedName.data, email: parsedEmail.data.toLowerCase() },
      {
        onSuccess: () => {
          toast.success('Profile updated')
          setEditing(false)
        },
        onError: (failure) => setError(errorMessage(failure)),
      },
    )
  }

  const savePassword = (event: FormEvent) => {
    event.preventDefault()
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    setError(undefined)
    actions.resetPassword.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(`${user.name} has been signed out and must use the new password`)
        setPassword('')
        setResetting(false)
      },
      onError: (failure) => setError(errorMessage(failure)),
    })
  }

  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-2">
      <h3 id="profile-heading" className="text-sm font-semibold">
        Profile & credentials
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setName(user.name)
            setEmail(user.email)
            setError(undefined)
            setEditing(true)
          }}
        >
          <Pencil size={16} aria-hidden="true" /> Edit details
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setError(undefined)
            setResetting(true)
          }}
        >
          <KeyRound size={16} aria-hidden="true" /> Reset password
        </Button>
      </div>
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit user details"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form" loading={actions.updateProfile.isPending}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={saveProfile} noValidate className="flex flex-col gap-4">
          <Input label="Full name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            label="Email"
            type="email"
            value={email}
            error={error}
            onChange={(event) => setEmail(event.target.value)}
          />
        </form>
      </Modal>
      <Modal
        open={resetting}
        onClose={() => setResetting(false)}
        title="Reset password"
        description={`${user.name} will be signed out everywhere and must use the new password.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setResetting(false)}>
              Cancel
            </Button>
            <Button type="submit" form="reset-user-form" loading={actions.resetPassword.isPending}>
              Reset password
            </Button>
          </>
        }
      >
        <form id="reset-user-form" onSubmit={savePassword} noValidate>
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={password}
            error={error}
            onChange={(event) => setPassword(event.target.value)}
          />
        </form>
      </Modal>
    </section>
  )
}
