import { CheckCircle2, Layers, ShieldCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const HIGHLIGHTS = [
  { icon: Layers, text: 'Plan work on Kanban boards and sortable lists' },
  { icon: Users, text: 'Invite your team with role-based access' },
  { icon: ShieldCheck, text: 'Per-project permissions you control' },
  { icon: CheckCircle2, text: 'Track progress from one personal dashboard' },
]

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-accent p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Layers size={24} aria-hidden="true" /> TeamFlow
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-9">Move work forward, together.</h2>
          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon size={16} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">Project management for focused teams.</p>
      </aside>
      <main className="relative flex items-center justify-center p-4 sm:p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card dark:shadow-none sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-lg font-semibold text-primary-text lg:hidden">
            <Layers size={20} aria-hidden="true" /> TeamFlow
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
