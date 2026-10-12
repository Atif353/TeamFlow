import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <ErrorState
          title="This page crashed"
          message="An unexpected error occurred while rendering. Reload to continue."
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }
}
