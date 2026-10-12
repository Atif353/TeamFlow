import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryClient } from '@/app/queryClient'
import { refreshSession } from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import {
  acceptInvite,
  fetchInvitePreview,
  login,
  logout,
  register,
  resendCode,
  verifyEmail,
} from '../api/authApi'

export function useSessionBootstrap() {
  useEffect(() => {
    refreshSession().catch(() => useAuthStore.getState().clearSession())
  }, [])
}

export function useLogin() {
  return useMutation({
    mutationFn: login,
    onSuccess: (payload) => {
      queryClient.clear()
      useAuthStore.getState().setSession(payload)
    },
  })
}

export function useRegister() {
  return useMutation({ mutationFn: register })
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: verifyEmail,
    onSuccess: (payload) => {
      queryClient.clear()
      useAuthStore.getState().setSession(payload)
    },
  })
}

export function useResendCode() {
  return useMutation({ mutationFn: resendCode })
}

export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: (input: Parameters<typeof acceptInvite>[1]) => acceptInvite(token, input),
    onSuccess: (payload) => {
      queryClient.clear()
      useAuthStore.getState().setSession(payload)
    },
  })
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: ['invite-preview', token],
    queryFn: () => fetchInvitePreview(token),
    retry: false,
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await logout()
      } catch {
        return
      }
    },
    onSettled: () => {
      useAuthStore.getState().clearSession()
      queryClient.clear()
    },
  })
}
