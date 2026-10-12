import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { CREATABLE_ISSUE_TYPES, ISSUE_TYPE_META, type IssueType } from '@/config/issueTypes'
import { cn } from '@/lib/cn'

interface IssueTypePickerProps {
  value: IssueType
  onChange: (type: IssueType) => void
}

export function IssueTypePicker({ value, onChange }: IssueTypePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span id="issue-type-label" className="text-sm font-medium">
        Issue type
      </span>
      <div
        role="radiogroup"
        aria-labelledby="issue-type-label"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {CREATABLE_ISSUE_TYPES.map((type) => {
          const selected = value === type
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(type)}
              className={cn(
                'flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors md:min-h-[38px]',
                selected
                  ? 'border-primary-500 bg-primary-50 text-primary-text'
                  : 'border-border hover:bg-surface-muted',
              )}
            >
              <IssueTypeIcon type={type} size={14} />
              <span className="truncate">{ISSUE_TYPE_META[type].label}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{ISSUE_TYPE_META[value].description}</p>
    </div>
  )
}
