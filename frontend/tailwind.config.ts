import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: token('primary-50'),
          100: token('primary-100'),
          500: token('primary-500'),
          600: token('primary-600'),
          700: token('primary-700'),
          DEFAULT: token('primary-600'),
        },
        accent: token('accent'),
        'primary-text': token('primary-text'),
        'accent-fg': token('accent-fg'),
        'success-fg': token('success-fg'),
        'warning-fg': token('warning-fg'),
        'danger-fg': token('danger-fg'),
        'danger-solid': token('danger-solid'),
        'info-fg': token('info-fg'),
        background: token('background'),
        surface: { DEFAULT: token('surface'), muted: token('surface-muted') },
        border: token('border'),
        foreground: token('foreground'),
        'muted-foreground': token('muted-foreground'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', '1rem'],
        sm: ['0.8125rem', '1.25rem'],
        base: ['0.875rem', '1.375rem'],
        lg: ['1rem', '1.5rem'],
        xl: ['1.125rem', '1.625rem'],
        '2xl': ['1.375rem', '1.75rem'],
        '3xl': ['1.625rem', '2rem'],
      },
      maxWidth: { page: '1400px' },
      boxShadow: {
        card: '0 1px 2px rgb(24 24 27 / 0.04)',
        lift: '0 8px 24px rgb(24 24 27 / 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
