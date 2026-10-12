import { Users } from 'lucide-react'
import { RoleBadge } from '@/components/common/RoleBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import type { TeamMemberRow } from '@/features/admin/types'
import { formatDuration } from '@/lib/duration'

export function TeamTable({ rows }: { rows: TeamMemberRow[] }) {
  const busiest = Math.max(1, ...rows.map((row) => row.open_issues))
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5">
        <Users size={16} aria-hidden="true" />
        <h3 className="text-sm font-semibold">Team workload</h3>
        <span className="text-xs text-muted-foreground">Everyone in the workspace</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Member</th>
              <th className="px-3 py-2.5 font-medium">Open issues</th>
              <th className="px-3 py-2.5 font-medium">Overdue</th>
              <th className="px-3 py-2.5 font-medium">Done (30d)</th>
              <th className="px-5 py-2.5 text-right font-medium">Time logged (30d)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={row.user.name}
                      color={row.user.avatar_color}
                      size="sm"
                      inactive={!row.user.is_active}
                    />
                    <span className="truncate font-medium">{row.user.name}</span>
                    <RoleBadge role={row.role} />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 tabular-nums">{row.open_issues}</span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                      <span
                        className="block h-full rounded-full bg-primary-500"
                        style={{ width: `${(row.open_issues / busiest) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {row.overdue > 0 ? (
                    <span className="font-medium text-danger-fg">{row.overdue}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-3 py-3 tabular-nums">{row.completed_30_days}</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {formatDuration(row.minutes_30_days)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
