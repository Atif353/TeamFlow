import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, FolderKanban, Search } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IssueTypeIcon } from '@/components/common/IssueTypeIcon'
import { routes } from '@/config/routes'
import { useGlobalSearch } from '@/features/agile'
import { useDialogBehavior } from '@/hooks/useDialogBehavior'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/cn'
import { fadeVariants, modalVariants } from '@/lib/motion'

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
}

interface Entry {
  key: string
  label: string
  hint: string
  to: string
  icon: React.ReactNode
}

function PalettePanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const ref = useDialogBehavior(onClose)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const query = useDebounce(text.trim(), 200)
  const results = useGlobalSearch(query)

  const entries = useMemo<Entry[]>(() => {
    const data = results.data
    if (!data || !query) return []
    return [
      ...data.issues.map((issue) => ({
        key: `i-${issue.id}`,
        label: `${issue.key} ${issue.title}`,
        hint: issue.project_name,
        to: routes.issue(issue.key),
        icon: <IssueTypeIcon type={issue.issue_type} />,
      })),
      ...data.docs.map((doc) => ({
        key: `d-${doc.id}`,
        label: doc.title,
        hint: `Doc · ${doc.project_name}`,
        to: routes.doc(doc.project_id, doc.id),
        icon: <BookOpen size={16} aria-hidden="true" />,
      })),
      ...data.projects.map((project) => ({
        key: `p-${project.id}`,
        label: project.name,
        hint: `Project · ${project.key}`,
        to: routes.summary(project.id),
        icon: <FolderKanban size={16} aria-hidden="true" />,
      })),
    ]
  }, [results.data, query])

  const choose = (entry: Entry) => {
    onClose()
    navigate(entry.to)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((value) => Math.min(value + 1, entries.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Enter' && entries[active]) {
      event.preventDefault()
      choose(entries[active])
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <motion.div
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        tabIndex={-1}
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-lift outline-none dark:shadow-none"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={16} className="text-muted-foreground" aria-hidden="true" />
          <input
            data-autofocus
            role="combobox"
            aria-expanded={entries.length > 0}
            aria-controls="search-results"
            aria-label="Search issues, docs and projects"
            placeholder="Search issues, docs and projects"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setActive(0)
            }}
            className="min-h-[52px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 text-xs text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>
        <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
          {entries.map((entry, index) => (
            <li
              key={entry.key}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(entry)}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 text-sm',
                index === active && 'bg-surface-muted',
              )}
            >
              {entry.icon}
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{entry.hint}</span>
            </li>
          ))}
        </ul>
        {query && results.isSuccess && entries.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        )}
        {!query && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Type an issue key like PROJ-12, a title, or a project name.
          </p>
        )}
      </motion.div>
    </div>
  )
}

export function SearchPalette({ open, onClose }: SearchPaletteProps) {
  return createPortal(
    <AnimatePresence>{open && <PalettePanel key="palette" onClose={onClose} />}</AnimatePresence>,
    document.body,
  )
}
