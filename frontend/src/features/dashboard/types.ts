import type { IssueType } from '@/config/issueTypes'
import type { NamedCount } from '@/features/agile/types'
import type { Priority } from '@/types/common'

export interface DashboardStats {
  assigned_open: number
  overdue: number
  due_this_week: number
  completed_this_week: number
}

export interface DashboardTask {
  id: string
  key: string
  issue_type: IssueType
  title: string
  project_id: string
  project_key: string
  project_name: string
  priority: Priority
  due_date: string | null
  status_name: string
  status_color: string
  is_overdue: boolean
}

export interface DashboardProject {
  id: string
  name: string
  key: string
  color: string
  total_tasks: number
  done_tasks: number
  progress_percent: number
}

export interface DashboardCharts {
  by_status: NamedCount[]
  by_type: NamedCount[]
  by_priority: NamedCount[]
  completed_per_day: { date: string; count: number }[]
  logged_per_day: { date: string; minutes: number }[]
  minutes_logged_week: number
}

export interface Dashboard {
  stats: DashboardStats
  charts: DashboardCharts
  my_tasks: DashboardTask[]
  projects: DashboardProject[]
}
