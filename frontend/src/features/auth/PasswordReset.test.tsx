import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useAuthStore } from '@/store/authStore'
import { server } from '@/test/msw/server'
import { currentPath, renderApp } from '@/test/utils'

describe('password reset', () => {
  beforeEach(() => useAuthStore.getState().clearSession())

  it('links to the reset flow from the login page', async () => {
    const { router } = renderApp('/login')

    await userEvent.click(await screen.findByRole('link', { name: /forgot your password/i }))

    await waitFor(() => expect(currentPath(router)).toBe('/forgot-password'))
  })

  it('requests a reset link and shows the development link', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('*/api/v1/auth/forgot-password', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({
          message: 'If an account exists for that email, a reset link has been sent',
          reset_url: 'http://localhost:5173/reset-password/abc123abc123',
        })
      }),
    )
    renderApp('/forgot-password')

    await userEvent.type(await screen.findByLabelText('Email'), 'mia@teamflow.io')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText(/a reset link has been sent/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /reset-password\/abc123abc123/ })).toBeInTheDocument()
    expect(bodies).toEqual([{ email: 'mia@teamflow.io' }])
  })

  it('validates the email before sending', async () => {
    renderApp('/forgot-password')

    await userEvent.click(await screen.findByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
  })

  it('sets a new password and returns to sign in', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('*/api/v1/auth/reset-password', async ({ request }) => {
        bodies.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { router } = renderApp('/reset-password/token-token-token')

    await userEvent.type(await screen.findByLabelText('New password'), 'Fresh12345')
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => expect(currentPath(router)).toBe('/login'))
    expect(bodies).toEqual([{ token: 'token-token-token', password: 'Fresh12345' }])
  })

  it('shows the server message for an expired link', async () => {
    server.use(
      http.post('*/api/v1/auth/reset-password', () =>
        HttpResponse.json(
          {
            code: 'reset_token_invalid',
            message: 'This reset link is invalid or has expired',
            details: {},
          },
          { status: 410 },
        ),
      ),
    )
    renderApp('/reset-password/stale-token-value')

    await userEvent.type(await screen.findByLabelText('New password'), 'Fresh12345')
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('This reset link is invalid or has expired')).toBeInTheDocument()
  })
})
