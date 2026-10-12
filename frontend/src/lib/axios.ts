import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/config/env'
import { useAuthStore } from '@/store/authStore'
import type { AuthPayload } from '@/types/common'

export interface ApiError {
  code: string
  message: string
  details: Record<string, string>
}

const clientConfig = {
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
}

export const api = axios.create(clientConfig)
const bareClient = axios.create(clientConfig)

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/invitations/accept']

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

let refreshPromise: Promise<AuthPayload> | null = null

export function refreshSession(): Promise<AuthPayload> {
  refreshPromise ??= bareClient
    .post<AuthPayload>('/auth/refresh')
    .then(({ data }) => {
      useAuthStore.getState().setSession(data)
      return data
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || !error.config) throw error
    const original = error.config as RetryableConfig
    const isAuthCall = AUTH_PATHS.some((path) => original.url?.startsWith(path))
    if (error.response?.status !== 401 || original._retried || isAuthCall) throw error
    original._retried = true
    try {
      await refreshSession()
    } catch {
      useAuthStore.getState().clearSession()
      throw error
    }
    return api(original)
  },
)

export function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const data = error.response?.data as Partial<ApiError> | undefined
    if (data?.code) {
      return {
        code: data.code,
        message: data.message ?? 'Request failed',
        details: data.details ?? {},
      }
    }
    if (!error.response) {
      return { code: 'network_error', message: 'Cannot reach the server', details: {} }
    }
  }
  return { code: 'unknown_error', message: 'Something went wrong', details: {} }
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message
}
