import { ArrowRightLeft, Check } from 'lucide-react'
import { Dropdown, type DropdownItem } from '@/components/ui/Dropdown'
import type { ProjectStatus } from '@/features/projects/types'

interface StatusMenuProps {
  statuses: ProjectStatus[]
  currentStatusId: string
  onSelect: (statusId: string) => void
  allowedIds?: ReadonlySet<string>
  taskTitle: string
  variant?: 'icon' | 'custom'
  children?: React.ReactNode
}

export function StatusMenu({
  statuses,
  currentStatusId,
  onSelect,
  allowedIds,
  taskTitle,
  variant = 'icon',
  children,
}: StatusMenuProps) {
  const items: DropdownItem[] = [...statuses]
    .sort((a, b) => a.order - b.order)
    .map((status) => ({
      key: status.id,
      label: status.name,
      icon: status.id === currentStatusId ? Check : undefined,
      disabled: status.id === currentStatusId || (allowedIds ? !allowedIds.has(status.id) : false),
      onSelect: () => onSelect(status.id),
    }))

  return (
    <Dropdown
      label={variant === 'icon' ? `Move ${taskTitle} to status` : `Change status of ${taskTitle}`}
      items={items}
      triggerClassName={
        variant === 'icon'
          ? 'h-11 w-11 justify-center text-muted-foreground hover:bg-surface-muted md:h-8 md:w-8'
          : undefined
      }
      trigger={children ?? <ArrowRightLeft size={16} aria-hidden="true" />}
    />
  )
}
