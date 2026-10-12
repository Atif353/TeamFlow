import type { IssueType, LinkType } from '@/config/issueTypes'
import type { Label } from '@/features/projects/types'
import type { Priority, UserBrief } from '@/types/common'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface IssueBrief {
  id: string
  key: string
  title: string
  issue_type: IssueType
  status_id: string
  priority: Priority
  done: boolean
}

export interface SprintBrief {
  id: string
  name: string
  state: 'planned' | 'active' | 'completed'
}

export interface VersionBrief {
  id: string
  name: string
  released: boolean
}

export interface Task {
  id: string
  key: string
  issue_number: number
  issue_type: IssueType
  project_id: string
  parent_id: string | null
  parent: IssueBrief | null
  epic_id: string | null
  epic: IssueBrief | null
  sprint_id: string | null
  sprint: SprintBrief | null
  version_id: string | null
  version: VersionBrief | null
  title: string
  description: string
  environment: string
  status_id: string
  priority: Priority
  assignee_id: string | null
  assignee: UserBrief | null
  creator_id: string
  creator: UserBrief | null
  start_date: string | null
  due_date: string | null
  labels: Label[]
  components: string[]
  checklist: ChecklistItem[]
  checklist_total: number
  checklist_done: number
  subtask_total: number
  subtask_done: number
  child_total: number
  child_done: number
  story_points: number | null
  original_estimate_minutes: number | null
  remaining_estimate_minutes: number | null
  time_spent_minutes: number
  flagged: boolean
  watchers: UserBrief[]
  is_watching: boolean
  blocked_by_open: number
  position: number
  rank: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type TaskSortField =
  | 'position'
  | 'rank'
  | 'created_at'
  | 'updated_at'
  | 'due_date'
  | 'priority'
  | 'title'
  | 'key'
  | 'story_points'

export interface TaskListParams {
  status_id?: string
  assignee_id?: string
  unassigned?: boolean
  priority?: Priority
  label_id?: string
  issue_type?: IssueType[]
  exclude_epics?: boolean
  epic_id?: string
  sprint_id?: string
  backlog?: boolean
  version_id?: string
  resolved?: boolean
  q?: string
  due_before?: string
  due_after?: string
  parent_id?: string
  include_subtasks?: boolean
  sort?: TaskSortField
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export interface TaskCreateInput {
  title: string
  description?: string
  issue_type?: IssueType
  status_id?: string
  priority?: Priority
  assignee_id?: string | null
  start_date?: string | null
  due_date?: string | null
  label_ids?: string[]
  components?: string[]
  parent_id?: string
  epic_id?: string | null
  sprint_id?: string | null
  version_id?: string | null
  environment?: string
  story_points?: number | null
  original_estimate_minutes?: number | null
}

export interface TaskUpdateInput {
  title?: string
  description?: string
  issue_type?: IssueType
  status_id?: string
  priority?: Priority
  assignee_id?: string | null
  start_date?: string | null
  due_date?: string | null
  label_ids?: string[]
  components?: string[]
  epic_id?: string | null
  sprint_id?: string | null
  version_id?: string | null
  environment?: string
  story_points?: number | null
  original_estimate_minutes?: number | null
  remaining_estimate_minutes?: number | null
  flagged?: boolean
}

export interface TaskMoveInput {
  status_id: string
  previous_task_id: string | null
  next_task_id: string | null
}

export interface TaskRankInput {
  previous_task_id: string | null
  next_task_id: string | null
  sprint_id?: string | null
  change_sprint?: boolean
}

export interface TaskFilterState {
  q: string
  assignee: string
  priority: string
  label: string
  status: string
  type: string
  epic: string
}

export interface ActivityEntry {
  id: string
  task_id: string
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  actor: UserBrief | null
  created_at: string
}

export interface Worklog {
  id: string
  task_id: string
  author: UserBrief | null
  minutes: number
  started_at: string
  comment: string
  created_at: string
}

export interface WorklogInput {
  minutes: number
  started_at?: string
  comment?: string
  remaining_minutes?: number
}

export interface IssueLink {
  id: string
  link_type: LinkType
  direction: 'outward' | 'inward'
  label: string
  issue: IssueBrief
  created_at: string
}

export interface Attachment {
  id: string
  task_id: string
  filename: string
  content_type: string
  size: number
  uploaded_by: UserBrief | null
  created_at: string
}

export interface BulkResult {
  succeeded: number
  failed: { task_id: string; message: string; code: string }[]
}
