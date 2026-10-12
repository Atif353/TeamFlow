import { Zap } from 'lucide-react'
import { ProgressBar } from '@/components/common/ProgressBar'
import { Card } from '@/components/ui/Card'
import { ISSUE_TYPE_META } from '@/config/issueTypes'
import type { Task } from '@/features/tasks'
import { cn } from '@/lib/cn'
import { percent } from '@/lib/formatters'

interface EpicPanelProps {
  epics: Task[]
  selected: string
  onSelect: (value: string) => void
}

export function EpicPanel({ epics, selected, onSelect }: EpicPanelProps) {
  const choose = (value: string) => onSelect(selected === value ? '' : value)
  return (
    <Card className="h-fit p-3">
      <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
        <Zap size={16} aria-hidden="true" /> Epics
      </h3>
      <ul className="flex flex-col gap-1">
        <li>
          <button
            type="button"
            aria-pressed={selected === 'none'}
            onClick={() => choose('none')}
            className={cn(
              'min-h-[40px] w-full rounded-lg px-2 text-left text-sm hover:bg-surface-muted',
              selected === 'none' && 'bg-primary-50 text-primary-text',
            )}
          >
            Issues without epic
          </button>
        </li>
        {epics.map((epic) => (
          <li key={epic.id}>
            <button
              type="button"
              aria-pressed={selected === epic.id}
              onClick={() => choose(epic.id)}
              className={cn(
                'flex w-full flex-col gap-1.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-muted',
                selected === epic.id && 'bg-primary-50 text-primary-text',
              )}
            >
              <span className="truncate font-medium">{epic.title}</span>
              <ProgressBar
                value={percent(epic.child_done, epic.child_total)}
                label={`${epic.title} progress`}
                color={ISSUE_TYPE_META.epic.color}
              />
              <span className="text-xs text-muted-foreground">
                {epic.child_done}/{epic.child_total} done
              </span>
            </button>
          </li>
        ))}
      </ul>
      {epics.length === 0 && (
        <p className="px-1 pt-2 text-xs text-muted-foreground">No epics yet.</p>
      )}
    </Card>
  )
}
