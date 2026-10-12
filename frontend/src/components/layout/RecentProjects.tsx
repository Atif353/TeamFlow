import { NavLink } from 'react-router-dom'
import { routes } from '@/config/routes'
import { useProjects } from '@/features/projects'
import { cn } from '@/lib/cn'

const RECENT_LIMIT = 5

export function RecentProjects({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useProjects({ page_size: RECENT_LIMIT })
  const items = projects.data?.items ?? []
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">Recent projects</p>
      {items.map((project) => (
        <NavLink
          key={project.id}
          to={routes.project(project.id)}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors md:min-h-[32px]',
              isActive
                ? 'bg-surface-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-surface-muted/70 hover:text-foreground',
            )
          }
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-[3px]"
            style={{ backgroundColor: project.color }}
          />
          <span className="truncate">{project.name}</span>
        </NavLink>
      ))}
    </div>
  )
}
