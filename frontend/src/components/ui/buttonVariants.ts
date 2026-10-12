import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-700',
        secondary: 'bg-surface-muted text-foreground hover:bg-border',
        outline: 'border border-border bg-surface text-foreground hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-surface-muted',
        danger: 'bg-danger-solid text-white hover:opacity-90',
      },
      size: {
        sm: 'h-11 px-3 text-sm md:h-8',
        md: 'h-11 px-3.5 text-sm md:h-9',
        lg: 'h-12 px-5 text-base md:h-11',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)
