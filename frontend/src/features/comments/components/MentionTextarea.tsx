import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { fieldClasses } from '@/components/ui/Input'
import type { MentionCandidate } from '../types'
import { activeMentionQuery, insertMention } from '../utils/mentions'

const MAX_SUGGESTIONS = 6

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  candidates: (MentionCandidate & { avatar_color: string })[]
  onSubmit?: () => void
  label: string
  placeholder?: string
  rows?: number
}

export function MentionTextarea({
  value,
  onChange,
  candidates,
  onSubmit,
  label,
  placeholder,
  rows = 3,
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const [caret, setCaret] = useState(0)
  const [highlight, setHighlight] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const pendingCaret = useRef<number | null>(null)

  const mention = activeMentionQuery(value, caret)
  const suggestions = useMemo(() => {
    if (!mention || dismissedAt === mention.start) return []
    const needle = mention.query.toLowerCase()
    return candidates
      .filter((candidate) => candidate.name.toLowerCase().includes(needle))
      .slice(0, MAX_SUGGESTIONS)
  }, [mention, candidates, dismissedAt])
  const open = suggestions.length > 0

  useEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
  }, [value])

  const choose = (candidate: MentionCandidate) => {
    if (!mention) return
    const result = insertMention(value, caret, mention.start, candidate.name)
    pendingCaret.current = result.caret
    setCaret(result.caret)
    setHighlight(0)
    onChange(result.text)
    ref.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlight((index) => (index + 1) % suggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlight((index) => (index - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selected = suggestions[highlight] ?? suggestions[0]
        if (selected) choose(selected)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (mention) setDismissedAt(mention.start)
        return
      }
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          setCaret(event.target.selectionStart)
          setHighlight(0)
          onChange(event.target.value)
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className={cn(fieldClasses, 'resize-y py-2')}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lift dark:shadow-none"
        >
          {suggestions.map((candidate, index) => (
            <li
              key={candidate.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(candidate)
              }}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-2 text-sm md:min-h-[36px]',
                index === highlight && 'bg-surface-muted',
              )}
            >
              <Avatar name={candidate.name} color={candidate.avatar_color} size="xs" />
              {candidate.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
