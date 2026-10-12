import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { routes } from '@/config/routes'
import { toApiError } from '@/lib/axios'
import { CodeInput } from '../components/CodeInput'
import { useResendCode, useVerifyEmail } from '../hooks/useAuth'
import { useCountdown } from '../hooks/useCountdown'
import type { VerificationState } from '../types'

const RESEND_SECONDS = 60
const MESSAGES: Record<string, string> = {
  invalid_code: 'That code is not correct. Check the email and try again.',
  code_expired: 'This code has expired. Request a new one.',
  too_many_attempts: 'Too many wrong attempts. Request a new code.',
}

export function VerifyEmailPage() {
  const state = useLocation().state as VerificationState | null
  const email = state?.email
  const autoResend = state?.resend === true
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState(state?.devCode ?? null)
  const verify = useVerifyEmail()
  const { mutate: resendCode, isPending: resending } = useResendCode()
  const { remaining, restart } = useCountdown(RESEND_SECONDS)
  const requested = useRef(false)

  useEffect(() => {
    if (!autoResend || !email || requested.current) return
    requested.current = true
    resendCode(email, {
      onSuccess: (result) => {
        setDevCode(result.dev_code)
        restart()
      },
      onError: (failure) => setError(toApiError(failure).message),
    })
  }, [autoResend, email, resendCode, restart])

  if (!email) return <Navigate to={routes.register} replace />

  const requestNewCode = () =>
    resendCode(email, {
      onSuccess: (result) => {
        setDevCode(result.dev_code)
        setCode('')
        setError(null)
        restart()
        toast.success('A new code is on its way')
      },
      onError: (failure) => setError(toApiError(failure).message),
    })

  const submit = (value: string) => {
    setError(null)
    verify.mutate(
      { email, code: value },
      {
        onError: (failure) => {
          const api = toApiError(failure)
          setError(MESSAGES[api.code] ?? api.message)
          setCode('')
        },
      },
    )
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
      footer={
        <Link to={routes.login} className="font-medium text-primary-text hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (code.length === 6) submit(code)
        }}
        className="flex flex-col gap-5"
      >
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={submit}
          invalid={Boolean(error)}
          disabled={verify.isPending}
        />
        {error && (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger-fg">
            {error}
          </p>
        )}
        {devCode && (
          <p className="rounded-md bg-surface-muted p-3 text-xs text-muted-foreground">
            Email delivery is not configured, so the development code is{' '}
            <span className="font-mono font-semibold text-foreground">{devCode}</span>.
          </p>
        )}
        <Button type="submit" fullWidth loading={verify.isPending} disabled={code.length < 6}>
          Verify email
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Did not get it?{' '}
          {remaining > 0 ? (
            <span>Resend available in {remaining}s</span>
          ) : (
            <button
              type="button"
              onClick={requestNewCode}
              disabled={resending}
              className="font-medium text-primary-text hover:underline"
            >
              Resend code
            </button>
          )}
        </p>
      </form>
    </AuthLayout>
  )
}
