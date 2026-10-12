import {
  Bell,
  FolderKanban,
  LayoutDashboard,
  MailPlus,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { routes } from './routes'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export const mainNavigation: NavItem[] = [
  { label: 'Dashboard', to: routes.dashboard, icon: LayoutDashboard },
  { label: 'Projects', to: routes.projects, icon: FolderKanban },
  { label: 'Notifications', to: routes.notifications, icon: Bell },
]

export const adminNavigation: NavItem[] = [
  { label: 'Users', to: routes.adminUsers, icon: Users },
  { label: 'Invitations', to: routes.adminInvitations, icon: MailPlus },
  { label: 'Audit log', to: routes.adminAudit, icon: ScrollText },
]
