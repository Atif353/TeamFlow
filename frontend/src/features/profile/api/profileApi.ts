import { api } from '@/lib/axios'
import type { EmailPreferences, User } from '@/types/common'

export async function updateProfile(name: string) {
  const { data } = await api.patch<User>('/users/me', { name })
  return data
}

export async function changePassword(input: { current_password: string; new_password: string }) {
  const { data } = await api.post<{ access_token: string }>('/users/me/password', input)
  return data
}

export async function updateEmailPreferences(preferences: EmailPreferences) {
  const { data } = await api.put<User>('/users/me/email-preferences', preferences)
  return data
}
