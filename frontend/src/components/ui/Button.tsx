import { type VariantProps } from 'class-variance-authority'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { tapScale } from '@/lib/motion'
import { buttonVariants } from './buttonVariants'
import { Spinner } from './Spinner'

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  children?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    loading = false,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || loading ? undefined : tapScale}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </motion.button>
  )
})
