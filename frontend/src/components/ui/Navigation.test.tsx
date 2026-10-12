import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Dropdown } from './Dropdown'
import { Tabs } from './Tabs'

describe('Dropdown keyboard navigation', () => {
  const setup = () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <Dropdown
        label="Actions"
        trigger="Open"
        items={[
          { key: 'edit', label: 'Edit', onSelect: onEdit },
          { key: 'delete', label: 'Delete', onSelect: onDelete },
        ]}
      />,
    )
    return { onEdit, onDelete }
  }

  it('opens with ArrowDown, moves with arrows and selects with Enter', async () => {
    const { onDelete } = setup()
    screen.getByRole('button', { name: 'Actions' }).focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(onDelete).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('wraps focus with arrows and supports Home and End', async () => {
    setup()
    screen.getByRole('button', { name: 'Actions' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await screen.findByRole('menu')

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    setup()
    const trigger = screen.getByRole('button', { name: 'Actions' })
    await userEvent.click(trigger)
    await screen.findByRole('menu')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
})

describe('Tabs keyboard navigation', () => {
  function Harness() {
    const [value, setValue] = useState('a')
    return (
      <Tabs
        ariaLabel="Sections"
        value={value}
        onChange={setValue}
        items={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
          { value: 'c', label: 'Gamma' },
        ]}
      />
    )
  }

  it('moves selection with arrow keys, wrapping at the ends', async () => {
    render(<Harness />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true')
  })

  it('activates a focused tab with Enter and uses roving tabindex', async () => {
    render(<Harness />)

    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '-1')
    screen.getByRole('tab', { name: 'Beta' }).focus()
    await userEvent.keyboard('{Enter}')

    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabindex', '0')
  })
})
