import { NavLink } from 'react-router-dom'
import { routes } from '@/config/routes'
import { cn } from '@/lib/cn'
import type { ProjectSection } from './projectSections'

interface ProjectNavProps {
  projectId: string
  sections: ProjectSection[]
}

export function ProjectNav({ projectId, sections }: ProjectNavProps) {
  return (
    <nav
      aria-label="Project sections"
      className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max gap-1">
        {sections.map((section) => (
          <li key={section.value}>
            <NavLink
              to={`${routes.project(projectId)}/${section.value}`}
              className={({ isActive }) =>
                cn(
                  '-mb-px flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors sm:min-h-[40px]',
                  isActive
                    ? 'border-primary-500 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              <section.icon size={16} aria-hidden="true" />
              {section.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
