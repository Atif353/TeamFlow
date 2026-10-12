import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildUser, buildWorkspace, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { currentPath, renderApp } from '@/test/utils'
import { useAuthStore } from '@/store/authStore'

const START = { state: { email: 'ada@teamflow.io', devCode: '654321' } }

function startAt(state: object) {
  const result = renderApp('/verify-email')
  void result.router.navigate('/verify-email', { state })
  return result
}

function authPayload() {
  return {
    user: buildUser({ email: 'ada@teamflow.io', name: 'Ada' }),
    workspace: buildWorkspace(),
    role: 'super_admin',
    access_token: 'token',
  }
}

describe('email verification', () => {
  beforeEach(() => useAuthStore.getState().clearSession())

  it('sends people without a pending sign-up back to the register page', async () => {
    const { router } = renderApp('/verify-email')

    await waitFor(() => expect(currentPath(router)).toBe('/register'))
  })

  it('verifies the code as soon as the sixth digit is typed and signs the user in', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('*/api/v1/auth/verify-email', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(authPayload())
      }),
      http.get('*/api/v1/dashboard/me', () => HttpResponse.json({})),
    )
    startAt(START.state)

    await userEvent.type(await screen.findByLabelText('Digit 1 of 6'), '654321')

    await waitFor(() => expect(bodies).toEqual([{ email: 'ada@teamflow.io', code: '654321' }]))
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))
  })

  it('accepts a pasted code', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('*/api/v1/auth/verify-email', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(authPayload())
      }),
      http.get('*/api/v1/dashboard/me', () => HttpResponse.json({})),
    )
    startAt(START.state)

    await userEvent.click(await screen.findByLabelText('Digit 1 of 6'))
    await userEvent.paste('123 456')

    await waitFor(() => expect(bodies).toEqual([{ email: 'ada@teamflow.io', code: '123456' }]))
  })

  it('shows a clear message and clears the boxes for a wrong code', async () => {
    server.use(
      http.post('*/api/v1/auth/verify-email', () =>
        HttpResponse.json(
          { code: 'invalid_code', message: 'That code is not correct', details: {} },
          { status: 422 },
        ),
      ),
    )
    startAt(START.state)

    await userEvent.type(await screen.findByLabelText('Digit 1 of 6'), '000000')

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not correct')
    await waitFor(() => expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue(''))
  })

  it('only accepts digits and supports backspace', async () => {
    startAt(START.state)

    const first = await screen.findByLabelText('Digit 1 of 6')
    await userEvent.type(first, 'a1b2')
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('1')
    expect(screen.getByLabelText('Digit 2 of 6')).toHaveValue('2')
    await userEvent.keyboard('{Backspace}{Backspace}')
    expect(screen.getByLabelText('Digit 2 of 6')).toHaveValue('')
  })

  it('shows the development code only when the server returns one', async () => {
    startAt({ email: 'ada@teamflow.io', devCode: null })

    await screen.findByLabelText('Digit 1 of 6')

    expect(screen.queryByText(/development code/i)).not.toBeInTheDocument()
  })

  it('shows the development code hint when email is not configured', async () => {
    startAt(START.state)

    expect(await screen.findByText('654321')).toBeInTheDocument()
  })

  it('disables resend during the cooldown', async () => {
    startAt(START.state)

    expect(await screen.findByText(/resend available in/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument()
  })

  it('sends unverified users from the login page to verification and requests a new code', async () => {
    const resent: unknown[] = []
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(
          { code: 'email_not_verified', message: 'Verify your email to continue', details: {} },
          { status: 403 },
        ),
      ),
      http.post('*/api/v1/auth/resend-code', async ({ request }) => {
        resent.push(await request.json())
        return HttpResponse.json({ dev_code: null })
      }),
    )
    const { router } = renderApp('/login')

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@teamflow.io')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(currentPath(router)).toBe('/verify-email'))
    await waitFor(() => expect(resent).toEqual([{ email: 'ada@teamflow.io' }]))
  })

  it('does not let signed-in users open the verification page', async () => {
    signIn('member')
    server.use(http.get('*/api/v1/dashboard/me', () => HttpResponse.json({})))

    const { router } = renderApp('/verify-email')

    await waitFor(() => expect(currentPath(router)).not.toBe('/verify-email'))
  })
})
