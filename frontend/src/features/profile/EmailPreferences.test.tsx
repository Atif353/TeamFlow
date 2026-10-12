import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { buildUser, signIn } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/utils'
import { useAuthStore } from '@/store/authStore'

describe('email notification preferences', () => {
  it('lists every notification type with the current setting', async () => {
    signIn('member')

    renderApp('/profile')

    expect(await screen.findByRole('switch', { name: 'Assigned to me' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Mentions' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Comments' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Daily summary' })).not.toBeChecked()
  })

  it('saves a change and updates the stored user', async () => {
    signIn('member')
    const bodies: Record<string, boolean>[] = []
    server.use(
      http.put('*/api/v1/users/me/email-preferences', async ({ request }) => {
        const body = (await request.json()) as Record<string, boolean>
        bodies.push(body)
        return HttpResponse.json(buildUser({ email_preferences: body as never }))
      }),
    )
    renderApp('/profile')

    await userEvent.click(await screen.findByRole('switch', { name: 'Daily summary' }))

    await waitFor(() => expect(bodies[0]?.daily_digest).toBe(true))
    expect(bodies[0]?.assigned).toBe(true)
    await waitFor(() =>
      expect(useAuthStore.getState().user?.email_preferences.daily_digest).toBe(true),
    )
  })
})
