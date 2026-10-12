import type { IssueType } from '@/config/issueTypes'
import type { Task } from '@/features/tasks/types'
import type { Priority, UserBrief } from '@/types/common'

export type SprintState = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string
  state: SprintState
  start_date: string | null
  end_date: string | null
  started_at: string | null
  completed_at: string | null
  issue_count: number
  done_count: number
  story_points: number
  done_points: number
  committed_points: number
  committed_issues: number
  completed_points: number
  completed_issues: number
}

export interface BacklogSprint {
  sprint: Sprint
  issues: Task[]
}

export interface Backlog {
  sprints: BacklogSprint[]
  backlog: Task[]
  epics: Task[]
}

export interface SprintInput {
  name: string
  goal?: string
  start_date?: string | null
  end_date?: string | null
}

export interface Version {
  id: string
  project_id: string
  name: string
  description: string
  start_date: string | null
  release_date: string | null
  released: boolean
  released_at: string | null
  issue_count: number
  done_count: number
}

export interface VersionInput {
  name: string
  description?: string
  start_date?: string | null
  release_date?: string | null
}

export interface NamedCount {
  key: string
  name: string
  color: string | null
  count: number
}

export interface UserCount {
  user: UserBrief | null
  count: number
  points: number
  minutes: number
}

export interface DayCreatedResolved {
  date: string
  created: number
  resolved: number
}

export interface EpicProgress {
  id: string
  key: string
  title: string
  total: number
  done: number
  story_points: number
  done_points: number
}

export interface ActivityRow {
  task_id: string
  task_key: string
  task_title: string
  actor: UserBrief | null
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface ProjectSummary {
  total: number
  done: number
  open: number
  overdue: number
  due_soon: number
  unassigned: number
  created_last_7_days: number
  resolved_last_7_days: number
  estimate_minutes: number
  spent_minutes: number
  remaining_minutes: number
  status_counts: NamedCount[]
  type_counts: NamedCount[]
  priority_counts: NamedCount[]
  assignee_counts: UserCount[]
  created_vs_resolved: DayCreatedResolved[]
  active_sprint: { sprint: Sprint; days_remaining: number | null } | null
  epics: EpicProgress[]
  recent_activity: ActivityRow[]
}

export interface BurndownReport {
  sprint: Sprint
  unit: 'points' | 'issues'
  total: number
  points: { date: string; ideal: number; remaining: number | null }[]
}

export interface VelocityReport {
  sprints: {
    sprint_id: string
    name: string
    committed_points: number
    completed_points: number
    committed_issues: number
    completed_issues: number
  }[]
  average_points: number
}

export interface CumulativeFlowReport {
  dates: string[]
  series: { status_id: string; name: string; color: string; counts: number[] }[]
}

export interface TimeTrackingReport {
  estimate_minutes: number
  spent_minutes: number
  remaining_minutes: number
  by_user: UserCount[]
  by_day: { date: string; minutes: number }[]
  top_issues: {
    task_id: string
    key: string
    title: string
    spent_minutes: number
    estimate_minutes: number | null
    remaining_minutes: number | null
  }[]
}

export interface WorkloadReport {
  rows: UserCount[]
}

export interface SavedFilter {
  id: string
  project_id: string
  name: string
  params: Record<string, string>
  created_at: string
}

export type AutomationTrigger = 'status_changed' | 'issue_created' | 'issue_assigned'
export type AutomationAction =
  'notify_assignee' | 'notify_watchers' | 'set_priority' | 'flag_issue' | 'add_comment'

export interface AutomationRule {
  id: string
  project_id: string
  name: string
  trigger: AutomationTrigger
  trigger_status_id: string | null
  action: AutomationAction
  action_value: string | null
  enabled: boolean
  run_count: number
  created_at: string
}

export interface AutomationRuleInput {
  name: string
  trigger: AutomationTrigger
  trigger_status_id?: string | null
  action: AutomationAction
  action_value?: string | null
  enabled?: boolean
}

export interface SearchResults {
  issues: {
    id: string
    key: string
    title: string
    issue_type: IssueType
    priority: Priority
    done: boolean
    project_id: string
    project_name: string
  }[]
  docs: { id: string; title: string; project_id: string; project_name: string }[]
  projects: { id: string; name: string; key: string; color: string }[]
}
