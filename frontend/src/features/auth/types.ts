import type { Role } from '@/types/common'

export interface InvitePreview {
  workspace_name: string
  email: string
  role: Role
  invited_by_name: string | null
  expires_at: string
}

export interface RegisterResult {
  email: string
  verification_required: boolean
  dev_code: string | null
}

export interface VerificationState {
  email: string
  devCode?: string | null
  resend?: boolean
}
