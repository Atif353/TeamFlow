import { ISSUE_TYPE_META, type IssueType } from '@/config/issueTypes'
import { cn } from '@/lib/cn'

interface IssueTypeIconProps {
  type: IssueType
  size?: number
  withLabel?: boolean
  className?: string
}

export function IssueTypeIcon({
  type,
  size = 16,
  withLabel = false,
  className,
}: IssueTypeIconProps) {
  const meta = ISSUE_TYPE_META[type]
  const Icon = meta.icon
  const tile = (
    <span
      role={withLabel ? undefined : 'img'}
      aria-label={withLabel ? undefined : meta.label}
      title={meta.label}
      style={{ backgroundColor: meta.color, width: size + 6, height: size + 6 }}
      className="inline-flex shrink-0 items-center justify-center rounded text-white"
    >
      <Icon size={size - 4} strokeWidth={2.5} aria-hidden="true" />
    </span>
  )
  if (!withLabel) return <span className={className}>{tile}</span>
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {tile}
      <span>{meta.label}</span>
    </span>
  )
}
