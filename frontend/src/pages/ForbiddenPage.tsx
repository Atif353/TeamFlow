import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { EmptyState } from '@/components/ui/EmptyState'
import { routes } from '@/config/routes'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="Your role does not allow you to view this area. Ask a workspace admin if you need access."
        action={
          <Link to={routes.dashboard} className={buttonVariants()}>
            Go to dashboard
          </Link>
        }
      />
    </div>
  )
}
