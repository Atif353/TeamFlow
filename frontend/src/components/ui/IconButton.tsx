import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button, type ButtonProps } from './Button'

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'aria-label'> {
  icon: LucideIcon
  label: string
  iconSize?: number
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, iconSize = 16, className, variant = 'ghost', size = 'md', ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      aria-label={label}
      title={label}
      variant={variant}
      size={size}
      className={cn('w-11 px-0 md:w-9', size === 'sm' && 'md:w-8', className)}
      {...props}
    >
      <Icon size={iconSize} aria-hidden="true" />
    </Button>
  )
})
