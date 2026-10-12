import { create } from 'zustand'
import type { AuthPayload, Role, User, Workspace } from '@/types/common'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: User | null
  workspace: Workspace | null
  role: Role | null
  setSession: (payload: AuthPayload) => void
  setAccessToken: (token: string) => void
  setUser: (user: User) => void
  setWorkspace: (workspace: Workspace) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  accessToken: null,
  user: null,
  workspace: null,
  role: null,
  setSession: ({ user, workspace, role, access_token }) =>
    set({ status: 'authenticated', user, workspace, role, accessToken: access_token }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setWorkspace: (workspace) => set({ workspace }),
  clearSession: () =>
    set({ status: 'unauthenticated', accessToken: null, user: null, workspace: null, role: null }),
}))
