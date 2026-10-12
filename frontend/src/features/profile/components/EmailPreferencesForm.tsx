import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import type { EmailPreferences } from '@/types/common'
import { updateEmailPreferences } from '../api/profileApi'

const OPTIONS: { key: keyof EmailPreferences; label: string; description: string }[] = [
  { key: 'assigned', label: 'Assigned to me', description: 'When someone assigns you an issue.' },
  { key: 'mentioned', label: 'Mentions', description: 'When someone @mentions you in a comment.' },
  {
    key: 'overdue',
    label: 'Overdue issues',
    description: 'When an issue assigned to you passes its due date.',
  },
  { key: 'comments', label: 'Comments', description: 'New comments on issues you watch.' },
  {
    key: 'status_changes',
    label: 'Status changes',
    description: 'When issues you watch change status.',
  },
  {
    key: 'daily_digest',
    label: 'Daily summary',
    description: 'One morning email with what is due and overdue.',
  },
]

export function EmailPreferencesForm() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const save = useMutation({
    mutationFn: updateEmailPreferences,
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Email preferences saved')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  if (!user) return null
  const preferences = user.email_preferences

  return (
    <ul className="flex flex-col divide-y divide-border">
      {OPTIONS.map((option) => (
        <li key={option.key} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <label htmlFor={`pref-${option.key}`} className="text-sm font-medium">
              {option.label}
            </label>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </div>
          <input
            id={`pref-${option.key}`}
            type="checkbox"
            role="switch"
            checked={preferences[option.key]}
            disabled={save.isPending}
            onChange={(event) =>
              save.mutate({ ...preferences, [option.key]: event.target.checked })
            }
            className="peer relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform checked:bg-primary-600 checked:after:translate-x-4 disabled:opacity-60"
          />
        </li>
      ))}
    </ul>
  )
}
