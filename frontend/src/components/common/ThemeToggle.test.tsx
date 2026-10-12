import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setPrefersDark } from '@/test/matchMedia'
import { applyTheme, useThemeStore } from '@/store/themeStore'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('toggles the dark class on the html element', async () => {
    render(<ThemeToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement).toHaveClass('dark')

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('persists the choice so it survives a reload', async () => {
    render(<ThemeToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))

    const saved = localStorage.getItem('teamflow-theme') ?? '{}'
    expect(JSON.parse(saved).state.mode).toBe('dark')

    useThemeStore.setState({ mode: 'system' })
    localStorage.setItem('teamflow-theme', saved)
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().mode).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('follows the operating system preference by default', () => {
    setPrefersDark(true)

    applyTheme(useThemeStore.getState().mode)

    expect(document.documentElement).toHaveClass('dark')
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })
})
