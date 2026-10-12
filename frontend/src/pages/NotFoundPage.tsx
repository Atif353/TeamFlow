import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { EmptyState } from '@/components/ui/EmptyState'
import { routes } from '@/config/routes'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Link to={routes.dashboard} className={buttonVariants()}>
            Go to dashboard
          </Link>
        }
      />
    </div>
  )
}
