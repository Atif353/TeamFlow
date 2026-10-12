import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SearchInput } from '@/components/ui/SearchInput'
import { routes } from '@/config/routes'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchProjects } from '../api/projectsApi'

export function ProjectSearch() {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const q = useDebounce(text.trim(), 250)
  const results = useQuery({
    queryKey: ['projects', 'search', q],
    queryFn: () => fetchProjects({ q, page_size: 6 }),
    enabled: q.length > 0,
  })

  useClickOutside(wrapperRef, () => setOpen(false), open)

  const close = () => {
    setOpen(false)
    setText('')
  }

  return (
    <div
      ref={wrapperRef}
      className="relative w-full max-w-sm"
      onFocus={() => setOpen(true)}
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <SearchInput
        value={text}
        onChange={setText}
        placeholder="Jump to a project"
        ariaLabel="Search projects"
      />
      {open && q.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border bg-surface p-1 shadow-lift dark:shadow-none">
          {results.isPending ? (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.isError ? (
            <p className="p-3 text-sm text-danger-fg">Search failed.</p>
          ) : results.data.items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matching projects.</p>
          ) : (
            <ul>
              {results.data.items.map((project) => (
                <li key={project.id}>
                  <Link
                    to={routes.board(project.id)}
                    onClick={close}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm hover:bg-surface-muted"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{project.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{project.key}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
