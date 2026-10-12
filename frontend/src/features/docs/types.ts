import type { UserBrief } from '@/types/common'
import type { IssueBrief } from '@/features/tasks/types'

export interface DocSummary {
  id: string
  project_id: string
  title: string
  updated_by: UserBrief | null
  updated_at: string
  created_at: string
  version_count: number
}

export interface DocVersion {
  number: number
  title: string
  saved_by: UserBrief | null
  saved_at: string
}

export interface Doc extends DocSummary {
  content: string
  versions: DocVersion[]
  linked_tasks: IssueBrief[]
}
