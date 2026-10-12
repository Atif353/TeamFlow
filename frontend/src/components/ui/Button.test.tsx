import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it.each([
    ['primary', 'bg-primary'],
    ['secondary', 'bg-surface-muted'],
    ['outline', 'border-border'],
    ['ghost', 'hover:bg-surface-muted'],
    ['danger', 'bg-danger-solid'],
  ] as const)('renders the %s variant classes', (variant, expected) => {
    render(<Button variant={variant}>Label</Button>)

    expect(screen.getByRole('button', { name: 'Label' })).toHaveClass(expected)
  })

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('blocks clicks and shows a spinner while loading', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: /save/i })

    await userEvent.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('blocks clicks when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('has a touch-friendly height on mobile', () => {
    render(<Button>Tap</Button>)

    expect(screen.getByRole('button')).toHaveClass('h-11')
  })
})
