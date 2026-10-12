import { motion } from 'framer-motion'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '@/components/common/ProgressBar'
import { AvatarGroup } from '@/components/ui/AvatarGroup'
import { Badge } from '@/components/ui/Badge'
import { Dropdown, type DropdownItem } from '@/components/ui/Dropdown'
import { can } from '@/config/roles'
import { routes } from '@/config/routes'
import { listItemVariants } from '@/lib/motion'
import { percent } from '@/lib/formatters'
import type { Project } from '../types'

interface ProjectCardProps {
  project: Project
  index: number
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

export function ProjectCard({ project, index, onEdit, onDelete }: ProjectCardProps) {
  const progress = percent(project.done_task_count, project.task_count)
  const menu: DropdownItem[] = []
  if (can(project.my_role, 'project:members')) {
    menu.push({ key: 'edit', label: 'Edit project', icon: Pencil, onSelect: () => onEdit(project) })
  }
  if (can(project.my_role, 'project:delete')) {
    menu.push({
      key: 'delete',
      label: 'Delete project',
      icon: Trash2,
      danger: true,
      onSelect: () => onDelete(project),
    })
  }

  return (
    <motion.li
      custom={index}
      variants={listItemVariants}
      initial="initial"
      animate="animate"
      layout
      className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-lift dark:shadow-none"
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: project.color }}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={routes.board(project.id)}
            className="block truncate text-base font-semibold text-foreground after:absolute after:inset-0 hover:underline"
          >
            {project.name}
          </Link>
          <Badge className="mt-1">{project.key}</Badge>
        </div>
        {menu.length > 0 && (
          <div className="relative z-10">
            <Dropdown
              label={`Actions for ${project.name}`}
              trigger={<MoreHorizontal size={16} aria-hidden="true" />}
              triggerClassName="h-11 w-11 justify-center hover:bg-surface-muted md:h-9 md:w-9"
              items={menu}
            />
          </div>
        )}
      </div>
      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {project.description || 'No description yet.'}
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {project.done_task_count}/{project.task_count} tasks done
          </span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} label={`${project.name} progress`} color={project.color} />
      </div>
      <AvatarGroup users={project.members} total={project.member_count} />
    </motion.li>
  )
}
