import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildUser, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/utils'
import { useAuthStore } from '@/store/authStore'

describe('profile page', () => {
  it('updates the display name and keeps the session store in sync', async () => {
    signIn('member')
    let body: unknown = null
    server.use(
      http.patch('*/api/v1/users/me', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(buildUser({ name: 'Mia Updated' }))
      }),
    )
    renderApp('/profile')

    const name = await screen.findByLabelText('Display name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Mia Updated')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(body).toEqual({ name: 'Mia Updated' }))
    await waitFor(() => expect(useAuthStore.getState().user?.name).toBe('Mia Updated'))
  })

  it('shows the wrong current password on the field', async () => {
    signIn('member')
    server.use(
      http.post('*/api/v1/users/me/password', () =>
        HttpResponse.json(
          { code: 'invalid_current_password', message: 'bad', details: {} },
          { status: 400 },
        ),
      ),
    )
    renderApp('/profile')

    await userEvent.type(await screen.findByLabelText('Current password'), 'WrongPass1')
    await userEvent.type(screen.getByLabelText('New password'), 'BrandNew123')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'BrandNew123')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
  })

  it('validates strength and confirmation before calling the API', async () => {
    signIn('member')
    renderApp('/profile')

    await userEvent.type(await screen.findByLabelText('Current password'), 'Password1')
    await userEvent.type(screen.getByLabelText('New password'), 'short')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('stores the new access token after a successful change', async () => {
    signIn('member')
    server.use(
      http.post('*/api/v1/users/me/password', () =>
        HttpResponse.json({ access_token: 'rotated', token_type: 'bearer' }),
      ),
    )
    renderApp('/profile')

    await userEvent.type(await screen.findByLabelText('Current password'), 'Password1')
    await userEvent.type(screen.getByLabelText('New password'), 'BrandNew123')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'BrandNew123')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('rotated'))
    expect(await screen.findByText(/Other devices were signed out/)).toBeInTheDocument()
  })
})
