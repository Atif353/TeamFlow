import { expect, test } from '@playwright/test'
import { PASSWORD, createProject, registerOwner, uniqueEmail } from './support/api'
import { signIn } from './support/ui'

test('E2E-6: create issues of several types, plan a sprint, log time and see it in reports', async ({
  page,
  request,
}) => {
  const owner = await registerOwner(request)
  const project = await createProject(request, owner, 'Jira flow project')
  await signIn(page, owner)

  await page.goto(`/projects/${project.id}/backlog`)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('combobox', { name: 'Project' }).selectOption({ index: 0 })
  await page.getByRole('button', { name: 'Continue' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create issue' })
  await dialog.getByRole('radio', { name: /epic/i }).click()
  await dialog.getByLabel('Summary').fill('Checkout revamp')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page).toHaveURL(/\/browse\/[A-Z0-9]+-1$/)
  await expect(page.getByRole('heading', { name: /Issues in this epic/ })).toBeVisible()

  await page.getByLabel('New child issue title').fill('Payment form')
  await page.getByRole('button', { name: 'Add child issue' }).click()
  await expect(page.getByRole('link', { name: /Payment form/ })).toBeVisible()
  await page.getByRole('link', { name: /Payment form/ }).click()
  await expect(page).toHaveURL(/\/browse\/[A-Z0-9]+-2$/)
  await expect(page.getByLabel('Type', { exact: true })).toHaveValue('story')

  await page.getByLabel('Original estimate').fill('1d')
  await page.getByLabel('Original estimate').press('Enter')
  await page.getByRole('button', { name: 'Log work' }).click()
  const log = page.getByRole('dialog', { name: 'Log work' })
  await log.getByLabel('Time spent').fill('2h')
  await log.getByRole('button', { name: 'Log work' }).click()
  await expect(page.getByText('2h logged')).toBeVisible()
  await expect(page.getByText('6h remaining')).toBeVisible()
  await page.getByRole('tab', { name: 'History' }).click()
  await expect(page.getByText(/changed original estimate|set original estimate/)).toBeVisible()

  await page.goto(`/projects/${project.id}/backlog`)
  await page.getByRole('button', { name: 'Create sprint' }).click()
  await page
    .getByRole('dialog', { name: 'Create sprint' })
    .getByRole('button', { name: 'Create sprint' })
    .click()
  await expect(page.getByRole('button', { name: /start sprint/i })).toBeVisible()

  await page.goto(`/projects/${project.id}/summary`)
  await expect(page.getByText('Time tracking')).toBeVisible()
  await expect(page.getByText('Epic progress')).toBeVisible()
  await page.goto(`/projects/${project.id}/timeline`)
  await expect(page.getByRole('link', { name: 'Checkout revamp' })).toBeVisible()
  await page.goto(`/projects/${project.id}/reports`)
  await expect(page.getByText('Sprint burndown')).toBeVisible()
})

test('E2E-7: a super admin creates a user, who can then sign in', async ({
  page,
  request,
  browser,
}) => {
  const owner = await registerOwner(request)
  await signIn(page, owner)
  const email = uniqueEmail('hire')

  await page.goto('/admin/users')
  await page.getByRole('button', { name: /create user/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Create user' })
  await dialog.getByLabel('Full name').fill('Nina Newhire')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Initial password').fill(PASSWORD)
  await dialog.getByLabel('Role').selectOption('member')
  await dialog.getByRole('button', { name: 'Create user' }).click()
  await expect(page.getByRole('dialog', { name: 'Manage user' })).toBeVisible()

  await page.goto('/admin/audit')
  await expect(page.getByText(/Created user Nina Newhire/)).toBeVisible()

  const context = await browser.newContext()
  const newPage = await context.newPage()
  await newPage.goto('/login')
  await newPage.getByLabel('Email', { exact: true }).fill(email)
  await newPage.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await newPage.getByRole('button', { name: 'Sign in' }).click()
  await expect(newPage).toHaveURL(/\/dashboard/)
  await context.close()
})
