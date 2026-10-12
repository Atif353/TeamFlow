import type { UserBrief } from '@/types/common'

export interface Comment {
  id: string
  task_id: string
  author: UserBrief | null
  body: string
  mentions: UserBrief[]
  created_at: string
  edited_at: string | null
}

export interface MentionCandidate {
  id: string
  name: string
}
