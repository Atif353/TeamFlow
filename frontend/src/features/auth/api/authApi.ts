import { api } from '@/lib/axios'
import type { AuthPayload } from '@/types/common'
import type { AcceptInviteInput, LoginInput, RegisterInput } from '../schemas/authSchemas'
import type { InvitePreview, RegisterResult } from '../types'

export async function login(input: LoginInput) {
  const { data } = await api.post<AuthPayload>('/auth/login', input)
  return data
}

export async function register(input: RegisterInput) {
  const payload = { ...input, workspace_name: input.workspace_name || undefined }
  const { data } = await api.post<RegisterResult>('/auth/register', payload)
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function fetchInvitePreview(token: string) {
  const { data } = await api.get<InvitePreview>(`/invitations/preview/${token}`)
  return data
}

export async function acceptInvite(token: string, input: AcceptInviteInput) {
  const { data } = await api.post<AuthPayload>(`/invitations/accept/${token}`, input)
  return data
}

export async function forgotPassword(email: string) {
  const { data } = await api.post<{ message: string; reset_url: string | null }>(
    '/auth/forgot-password',
    { email },
  )
  return data
}

export async function resetPassword(token: string, password: string) {
  await api.post('/auth/reset-password', { token, password })
}

export async function verifyEmail(input: { email: string; code: string }) {
  const { data } = await api.post<AuthPayload>('/auth/verify-email', input)
  return data
}

export async function resendCode(email: string) {
  const { data } = await api.post<{ dev_code: string | null }>('/auth/resend-code', { email })
  return data
}
