import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDialogBehavior } from '@/hooks/useDialogBehavior'
import { cn } from '@/lib/cn'
import { fadeVariants, modalVariants } from '@/lib/motion'
import { IconButton } from './IconButton'

type ModalSize = 'sm' | 'md' | 'lg'

const SIZES: Record<ModalSize, string> = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: ModalSize
  children: ReactNode
  footer?: ReactNode
}

function ModalPanel({
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
}: Omit<ModalProps, 'open'>) {
  const titleId = useId()
  const ref = useDialogBehavior(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 bg-slate-900/50"
        data-testid="modal-backdrop"
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-lift outline-none dark:shadow-none sm:rounded-xl',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 md:p-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <IconButton icon={X} label="Close dialog" size="sm" onClick={onClose} />
        </div>
        <div className="overflow-y-auto p-4 md:p-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end md:px-5">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  )
}

export function Modal({ open, ...props }: ModalProps) {
  return createPortal(
    <AnimatePresence>{open && <ModalPanel key="modal" {...props} />}</AnimatePresence>,
    document.body,
  )
}
