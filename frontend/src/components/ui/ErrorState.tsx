import { AlertTriangle } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { Button } from './Button'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={message}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  )
}
