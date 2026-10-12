import { http, HttpResponse } from 'msw'
import { buildUser, buildWorkspace } from '@/test/fixtures'
import { server } from '@/test/msw/server'
import { useAuthStore } from '@/store/authStore'
import { api, refreshSession, toApiError, type ApiError } from './axios'

const refreshed = (token: string) => ({
  user: buildUser(),
  workspace: buildWorkspace(),
  role: 'member' as const,
  access_token: token,
})

describe('axios instance', () => {
  it('attaches the bearer token from the auth store', async () => {
    let received: string | null = null
    server.use(
      http.get('*/api/v1/ping', ({ request }) => {
        received = request.headers.get('authorization')
        return HttpResponse.json({})
      }),
    )
    useAuthStore.setState({ accessToken: 'abc' })

    await api.get('/ping')

    expect(received).toBe('Bearer abc')
  })

  it('silently refreshes an expired token and retries the request once', async () => {
    const seen: (string | null)[] = []
    let refreshCalls = 0
    server.use(
      http.get('*/api/v1/secret', ({ request }) => {
        seen.push(request.headers.get('authorization'))
        return request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json(
              { code: 'token_expired', message: 'expired', details: {} },
              { status: 401 },
            )
      }),
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json(refreshed('fresh'))
      }),
    )
    useAuthStore.setState({ status: 'authenticated', accessToken: 'stale' })

    const response = await api.get('/secret')

    expect(response.data).toEqual({ ok: true })
    expect(seen).toEqual(['Bearer stale', 'Bearer fresh'])
    expect(refreshCalls).toBe(1)
    expect(useAuthStore.getState().accessToken).toBe('fresh')
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('shares one refresh between concurrent failing requests', async () => {
    let refreshCalls = 0
    server.use(
      http.get('*/api/v1/data/:id', ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json(
              { code: 'token_expired', message: 'x', details: {} },
              { status: 401 },
            ),
      ),
      http.post('*/api/v1/auth/refresh', async () => {
        refreshCalls += 1
        return HttpResponse.json(refreshed('fresh'))
      }),
    )
    useAuthStore.setState({ status: 'authenticated', accessToken: 'stale' })

    await Promise.all([api.get('/data/1'), api.get('/data/2'), api.get('/data/3')])

    expect(refreshCalls).toBe(1)
  })

  it('logs the user out when the refresh fails', async () => {
    server.use(
      http.get('*/api/v1/secret', () =>
        HttpResponse.json({ code: 'token_expired', message: 'x', details: {} }, { status: 401 }),
      ),
      http.post('*/api/v1/auth/refresh', () =>
        HttpResponse.json(
          { code: 'invalid_refresh_token', message: 'x', details: {} },
          { status: 401 },
        ),
      ),
    )
    useAuthStore.setState({ status: 'authenticated', accessToken: 'stale' })

    await expect(api.get('/secret')).rejects.toBeDefined()

    expect(useAuthStore.getState().status).toBe('unauthenticated')
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('does not try to refresh failed logins', async () => {
    let refreshCalls = 0
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(
          { code: 'invalid_credentials', message: 'Invalid', details: {} },
          { status: 401 },
        ),
      ),
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json(refreshed('x'))
      }),
    )

    await expect(api.post('/auth/login', {})).rejects.toBeDefined()

    expect(refreshCalls).toBe(0)
  })

  it('maps server error bodies to ApiError', async () => {
    server.use(
      http.get('*/api/v1/boom', () =>
        HttpResponse.json(
          { code: 'conflict', message: 'Nope', details: { a: 'b' } },
          { status: 409 },
        ),
      ),
    )

    const error = await api.get('/boom').catch(toApiError)

    expect(error).toEqual({ code: 'conflict', message: 'Nope', details: { a: 'b' } })
  })

  it('maps network failures to a friendly error', async () => {
    server.use(http.get('*/api/v1/down', () => HttpResponse.error()))

    const error = await api.get('/down').catch((failure: unknown) => toApiError(failure))

    expect((error as ApiError).code).toBe('network_error')
  })

  it('exposes refreshSession for session bootstrap', async () => {
    server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.json(refreshed('boot'))))

    await refreshSession()

    expect(useAuthStore.getState().accessToken).toBe('boot')
    expect(useAuthStore.getState().user?.name).toBe('Mia Member')
  })
})
