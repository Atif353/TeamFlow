import { Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { useSearchShortcut } from '../hooks/useSearchShortcut'
import { SearchPalette } from './SearchPalette'

export function SearchTrigger({ compact }: { compact: boolean }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((value) => !value), [])
  useSearchShortcut(toggle)
  return (
    <>
      {compact ? (
        <IconButton icon={Search} label="Search" onClick={() => setOpen(true)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search issues, docs and projects"
          className="flex min-h-[38px] w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted-foreground hover:bg-surface-muted"
        >
          <Search size={16} aria-hidden="true" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border px-1.5 text-xs">Ctrl K</kbd>
        </button>
      )}
      <SearchPalette open={open} onClose={() => setOpen(false)} />
    </>
  )
}
