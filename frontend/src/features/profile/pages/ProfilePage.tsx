import { RoleBadge } from '@/components/common/RoleBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/formatters'
import { useAuthStore } from '@/store/authStore'
import { EmailPreferencesForm } from '../components/EmailPreferencesForm'
import { PasswordForm } from '../components/PasswordForm'
import { ProfileForm } from '../components/ProfileForm'

export function ProfilePage() {
  const user = useAuthStore((state) => state.user)
  const workspace = useAuthStore((state) => state.workspace)
  const role = useAuthStore((state) => state.role)
  if (!user || !role) return null

  return (
    <>
      <PageHeader title="Profile" description="Manage your account details and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardBody className="flex flex-wrap items-center gap-4 pt-4 md:pt-5">
            <Avatar name={user.name} color={user.avatar_color} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {workspace?.name} · member since {formatDate(user.created_at)}
              </p>
            </div>
            <RoleBadge role={role} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Personal details</h2>
          </CardHeader>
          <CardBody>
            <ProfileForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Change password</h2>
          </CardHeader>
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <h2 className="text-base font-semibold">Email notifications</h2>
              <p className="text-sm text-muted-foreground">
                Choose which events are sent to {user.email}. In-app notifications are always on.
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <EmailPreferencesForm />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
