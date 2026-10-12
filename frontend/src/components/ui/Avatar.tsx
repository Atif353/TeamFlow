import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/formatters'

const avatarVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white',
  {
    variants: {
      size: {
        xs: 'h-5 w-5 text-[9px]',
        sm: 'h-7 w-7 text-[11px]',
        md: 'h-9 w-9 text-xs',
        lg: 'h-12 w-12 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string
  color: string
  inactive?: boolean
  className?: string
}

export function Avatar({ name, color, size, inactive = false, className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={inactive ? `${name} (deactivated)` : name}
      title={inactive ? `${name} (deactivated)` : name}
      style={{ backgroundColor: color }}
      className={cn(avatarVariants({ size }), inactive && 'opacity-50 grayscale', className)}
    >
      {initials(name)}
    </span>
  )
}
