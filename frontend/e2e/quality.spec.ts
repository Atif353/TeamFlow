import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createProject, createTask, registerOwner } from './support/api'
import { signIn } from './support/ui'

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]

async function settled(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
    `loading state on ${page.url()}`,
  ).toHaveCount(0)
  await page.waitForTimeout(800)
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

async function criticalViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  )
}

test('T11.2: key screens have no horizontal scroll at 375, 768 and 1280 in light and dark mode', async ({
  page,
  request,
}) => {
  test.setTimeout(300_000)
  const owner = await registerOwner(request)
  const project = await createProject(request, owner, 'Responsive project')
  await createTask(request, owner, project.id, 'Responsive task', { assignee_id: owner.id })
  await signIn(page, owner)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      for (const path of [
        '/dashboard',
        '/projects',
        `/projects/${project.id}/board`,
        `/projects/${project.id}/list`,
        '/admin/users',
      ]) {
        await page.goto(path)
        await settled(page)
        await expectNoHorizontalScroll(page)
      }
    }
  }
})

test('NFR-USE-006: no critical accessibility violations on core screens', async ({
  page,
  request,
}) => {
  test.setTimeout(300_000)
  const owner = await registerOwner(request)
  const project = await createProject(request, owner, 'A11y project')
  await createTask(request, owner, project.id, 'A11y task', { assignee_id: owner.id })

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/login')
    expect(await criticalViolations(page), `login ${scheme}`).toEqual([])
    await page.goto('/register')
    expect(await criticalViolations(page), `register ${scheme}`).toEqual([])
  }

  await signIn(page, owner)
  const paths = [
    '/dashboard',
    '/projects',
    `/projects/${project.id}/board`,
    `/projects/${project.id}/list`,
    `/projects/${project.id}/members`,
    '/admin/users',
    '/profile',
  ]
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const path of paths) {
      await page.goto(path)
      await settled(page)
      expect(await criticalViolations(page), `${path} ${scheme}`).toEqual([])
    }
  }
})

test('T1.6: reduced motion removes transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')

  const duration = await page
    .getByRole('button', { name: 'Sign in' })
    .evaluate((node) => getComputedStyle(node).transitionDuration)

  expect(parseFloat(duration)).toBeLessThan(0.01)
})

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /switch to (dark|light) mode/i }).click()
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))

  await page.reload()

  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
    isDark,
  )
})

test('mobile navigation drawer opens and navigates', async ({ page, request }) => {
  const owner = await registerOwner(request)
  await signIn(page, owner)
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/dashboard')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Projects' }).click()

  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden()
})
