import { expect, test } from '@playwright/test'
import {
  addMember,
  createProject,
  createTask,
  deactivate,
  inviteAndAccept,
  registerOwner,
} from './support/api'
import { signIn } from './support/ui'

test('E2E-2: admin invites a member through the UI and the member sees only allowed projects', async ({
  page,
  browser,
  request,
}) => {
  const owner = await registerOwner(request)
  const allowed = await createProject(request, owner, 'Allowed project')
  await createProject(request, owner, 'Secret project')

  await signIn(page, owner)
  await page.goto('/admin/invitations')
  await page.getByRole('button', { name: 'Invite user' }).first().click()
  const email = `invitee-${Date.now()}@teamflow.io`
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Role', { exact: true }).selectOption('member')
  await page.getByRole('button', { name: 'Create invitation' }).click()
  const link = await page.getByLabel('Invite link', { exact: true }).inputValue()
  expect(link).toContain('/invite/')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('cell', { name: email, exact: true })).toBeVisible()

  const memberContext = await browser.newContext()
  const memberPage = await memberContext.newPage()
  await memberPage.goto(new URL(link).pathname)
  await expect(memberPage.getByRole('heading', { name: 'Join E2E Workspace' })).toBeVisible()
  await memberPage.getByLabel('Full name', { exact: true }).fill('Milo Member')
  await memberPage.getByLabel('Password', { exact: true }).fill('Password1')
  await memberPage.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(memberPage).toHaveURL(/\/dashboard/)

  await page.goto('/admin/users')
  await page.getByRole('row', { name: 'Manage Milo Member' }).click()
  const drawer = page.getByRole('dialog', { name: 'Manage user' })
  const membership = drawer.getByRole('checkbox', { name: /Allowed project/ })
  await membership.click()
  await expect(membership).toBeChecked()
  await expect(drawer.getByLabel('Role in Allowed project', { exact: true })).toBeVisible()

  await memberPage.goto('/projects')
  await expect(memberPage.getByRole('link', { name: 'Allowed project' })).toBeVisible()
  await expect(memberPage.getByRole('link', { name: 'Secret project' })).toHaveCount(0)
  await memberPage.goto(`/projects/${allowed.id}/board`)
  await expect(memberPage.getByRole('heading', { name: 'Allowed project' })).toBeVisible()
  await memberPage.goto('/admin')
  await expect(memberPage).toHaveURL(/\/403/)
  await memberContext.close()
})

test('E2E-3: a viewer can read everything assigned and has no write controls', async ({
  page,
  request,
}) => {
  const owner = await registerOwner(request)
  const viewer = await inviteAndAccept(request, owner, 'viewer', 'Vic Viewer')
  const project = await createProject(request, owner, 'Read only project')
  await addMember(request, owner, project.id, viewer.id)
  await createTask(request, owner, project.id, 'A visible task')

  await signIn(page, viewer)
  await page.goto(`/projects/${project.id}/board`)

  await expect(page.getByRole('button', { name: 'Open task A visible task' })).toHaveAttribute(
    'aria-roledescription',
    'task',
  )
  await expect(page.getByRole('button', { name: /new issue/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /add task to/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open task A visible task' }).click()
  await expect(page.getByLabel('Priority', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Write a comment', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Log work' })).toHaveCount(0)
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0)
  await page.goto('/projects')
  await expect(page.getByRole('button', { name: /new project/i })).toHaveCount(0)
})

test('E2E-4: a per-project override changes permissions in that project only', async ({
  page,
  browser,
  request,
}) => {
  const owner = await registerOwner(request)
  const member = await inviteAndAccept(request, owner, 'member', 'Mona Member')
  const restricted = await createProject(request, owner, 'Restricted project')
  const normal = await createProject(request, owner, 'Normal project')
  await addMember(request, owner, restricted.id, member.id)
  await addMember(request, owner, normal.id, member.id)

  await signIn(page, owner)
  await page.goto('/admin/users')
  await page.getByRole('row', { name: 'Manage Mona Member' }).click()
  const drawer = page.getByRole('dialog', { name: 'Manage user' })
  await drawer.getByLabel('Role in Restricted project', { exact: true }).selectOption('viewer')
  await expect(drawer.getByLabel('Role in Restricted project', { exact: true })).toHaveValue(
    'viewer',
  )

  const memberContext = await browser.newContext()
  const memberPage = await memberContext.newPage()
  await signIn(memberPage, member)
  await memberPage.goto(`/projects/${restricted.id}/board`)
  await expect(memberPage.getByRole('heading', { name: 'Restricted project' })).toBeVisible()
  await expect(memberPage.getByRole('button', { name: /new issue/i })).toHaveCount(0)
  await memberPage.goto(`/projects/${normal.id}/board`)
  await expect(memberPage.getByRole('button', { name: /new issue/i })).toBeVisible()

  await drawer.getByLabel('Role in Restricted project', { exact: true }).selectOption('')
  await expect(drawer.getByLabel('Role in Restricted project', { exact: true })).toHaveValue('')
  await memberPage.goto(`/projects/${restricted.id}/board`)
  await expect(memberPage.getByRole('button', { name: /new issue/i })).toBeVisible()
  await memberContext.close()
})

test('E2E-5: a deactivated user is kicked out on the next request', async ({
  page,
  browser,
  request,
}) => {
  const owner = await registerOwner(request)
  const member = await inviteAndAccept(request, owner, 'member', 'Dan Deactivated')
  const project = await createProject(request, owner, 'Shared project')
  await addMember(request, owner, project.id, member.id)

  const memberContext = await browser.newContext()
  const memberPage = await memberContext.newPage()
  await signIn(memberPage, member)
  await memberPage.goto(`/projects/${project.id}/board`)
  await expect(memberPage.getByRole('heading', { name: 'Shared project' })).toBeVisible()

  await deactivate(request, owner, member.id)
  await memberPage
    .getByRole('navigation', { name: 'Project sections' })
    .getByRole('link', { name: 'List' })
    .click()

  await expect(memberPage).toHaveURL(/\/login/)
  await memberPage.getByLabel('Email', { exact: true }).fill(member.email)
  await memberPage.getByLabel('Password', { exact: true }).fill('Password1')
  await memberPage.getByRole('button', { name: 'Sign in' }).click()
  await expect(memberPage.getByRole('alert')).toContainText('deactivated')
  await memberContext.close()
  await page.close()
})
