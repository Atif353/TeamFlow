import {
  BarChart3,
  BookOpen,
  CalendarDays,
  GanttChart,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { can } from '@/config/roles'
import type { Role } from '@/types/common'

export interface ProjectSection {
  value: string
  label: string
  icon: LucideIcon
}

const SECTIONS: ProjectSection[] = [
  { value: 'summary', label: 'Summary', icon: LayoutDashboard },
  { value: 'timeline', label: 'Timeline', icon: GanttChart },
  { value: 'backlog', label: 'Backlog', icon: ListTodo },
  { value: 'board', label: 'Board', icon: KanbanSquare },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'list', label: 'List', icon: ListChecks },
  { value: 'reports', label: 'Reports', icon: BarChart3 },
  { value: 'docs', label: 'Docs', icon: BookOpen },
  { value: 'members', label: 'Members', icon: Users },
]

export function sectionsFor(role: Role): ProjectSection[] {
  return can(role, 'project:members')
    ? [...SECTIONS, { value: 'settings', label: 'Settings', icon: Settings }]
    : SECTIONS
}
