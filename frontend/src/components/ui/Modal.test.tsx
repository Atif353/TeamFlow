import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Modal
        open={open}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        title="Edit thing"
        footer={<Button>Save</Button>}
      >
        <input aria-label="Field" />
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('opens as an accessible dialog and moves focus inside', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit thing' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('traps focus with Tab and Shift+Tab', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = await screen.findByRole('dialog')

    for (let index = 0; index < 8; index += 1) {
      await userEvent.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    for (let index = 0; index < 8; index += 1) {
      await userEvent.tab({ shift: true })
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('closes on Escape and restores focus to the opener', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)
    await screen.findByRole('dialog')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(opener).toHaveFocus()
  })

  it('closes when the backdrop is clicked', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByTestId('modal-backdrop'))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes from the close button', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Close dialog' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
