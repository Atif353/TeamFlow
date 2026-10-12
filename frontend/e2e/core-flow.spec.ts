import { expect, test } from '@playwright/test'
import { PASSWORD, uniqueEmail } from './support/api'
import { completeVerification } from './support/ui'

test('E2E-1: sign up, create project and task, drag it on the board, see it on the dashboard', async ({
  page,
}) => {
  await page.goto('/register')
  await page.getByLabel('Full name', { exact: true }).fill('Eve Explorer')
  await page.getByLabel('Email', { exact: true }).fill(uniqueEmail('eve'))
  await page.getByLabel('Workspace name (optional)', { exact: true }).fill('Eve Labs')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await completeVerification(page)
  await page.getByRole('tab', { name: 'My work' }).click()
  await expect(page.getByText('Nothing assigned to you')).toBeVisible()

  await page.getByRole('link', { name: 'Projects' }).first().click()
  await page.getByRole('button', { name: 'New project' }).first().click()
  await page.getByLabel('Name', { exact: true }).fill('Rocket')
  await page.getByLabel('Key', { exact: true }).fill('RKT')
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('main').getByRole('link', { name: 'Rocket' }).click()
  await expect(page).toHaveURL(/\/board$/)

  await page.getByRole('button', { name: 'Add task to To Do' }).click()
  await page.getByLabel('New task title in To Do', { exact: true }).fill('Launch the rocket')
  await page.keyboard.press('Enter')
  const card = page.getByRole('button', { name: 'Open task Launch the rocket' })
  await expect(card).toBeVisible()

  await card.click()
  await expect(page).toHaveURL(/\/browse\/RKT-1$/)
  await page.getByLabel('Assignee', { exact: true }).selectOption({ label: 'Eve Explorer' })
  await expect(page.getByLabel('Assignee', { exact: true })).toHaveValue(/.+/)
  await page.getByRole('link', { name: 'Back to board' }).click()
  await expect(page).toHaveURL(/\/board$/)

  const target = page.getByRole('region', { name: 'In Progress column' })
  const source = await card.boundingBox()
  const destination = await target.boundingBox()
  if (!source || !destination) throw new Error('Board layout not measurable')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + source.height / 2 + 20, {
    steps: 4,
  })
  await page.mouse.move(destination.x + destination.width / 2, destination.y + 120, { steps: 12 })
  await page.mouse.up()
  await expect(target.getByText('Launch the rocket')).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('region', { name: 'In Progress column' }).getByText('Launch the rocket'),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await page.getByRole('tab', { name: 'My work' }).click()
  await expect(page.getByText('Launch the rocket')).toBeVisible()
  await expect(page.getByText('Assigned to me').locator('xpath=ancestor::div[1]')).toContainText(
    '1',
  )
})

test('E2E: a reloaded page keeps the session and logout blocks protected routes', async ({
  page,
}) => {
  await page.goto('/register')
  await page.getByLabel('Full name', { exact: true }).fill('Sam Session')
  await page.getByLabel('Email', { exact: true }).fill(uniqueEmail('sam'))
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await completeVerification(page)

  await page.reload()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/projects')
  await expect(page).toHaveURL(/\/login/)
})
