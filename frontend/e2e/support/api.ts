import type { APIRequestContext } from '@playwright/test'

export const PASSWORD = 'Password1'

export interface Account {
  id: string
  name: string
  email: string
  token: string
}

let counter = 0
export function uniqueEmail(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter}@teamflow.io`
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function registerOwner(
  request: APIRequestContext,
  name = 'Olga Owner',
): Promise<Account> {
  const email = uniqueEmail('owner')
  const registered = await request.post('/api/v1/auth/register', {
    data: { name, email, password: PASSWORD, workspace_name: 'E2E Workspace' },
  })
  const { dev_code: code } = await registered.json()
  const response = await request.post('/api/v1/auth/verify-email', { data: { email, code } })
  const body = await response.json()
  return { id: body.user.id, name, email, token: body.access_token }
}

export async function inviteAndAccept(
  request: APIRequestContext,
  owner: Account,
  role: 'project_manager' | 'member' | 'viewer',
  name: string,
): Promise<Account> {
  const email = uniqueEmail(role)
  const invitation = await request.post('/api/v1/invitations', {
    headers: auth(owner.token),
    data: { email, role },
  })
  const token = (await invitation.json()).invite_url.split('/').pop()
  const accepted = await request.post(`/api/v1/invitations/accept/${token}`, {
    data: { name, password: PASSWORD },
  })
  const body = await accepted.json()
  return { id: body.user.id, name, email, token: body.access_token }
}

export async function createProject(request: APIRequestContext, actor: Account, name: string) {
  const key = `E${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const response = await request.post('/api/v1/projects', {
    headers: auth(actor.token),
    data: { name, key },
  })
  return (await response.json()) as {
    id: string
    name: string
    statuses: { id: string; name: string }[]
  }
}

export async function addMember(
  request: APIRequestContext,
  actor: Account,
  projectId: string,
  userId: string,
) {
  await request.post(`/api/v1/projects/${projectId}/members`, {
    headers: auth(actor.token),
    data: { user_id: userId },
  })
}

export async function createTask(
  request: APIRequestContext,
  actor: Account,
  projectId: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const response = await request.post(`/api/v1/projects/${projectId}/tasks`, {
    headers: auth(actor.token),
    data: { title, ...extra },
  })
  return (await response.json()) as { id: string; title: string }
}

export async function deactivate(request: APIRequestContext, admin: Account, userId: string) {
  await request.patch(`/api/v1/admin/users/${userId}/status`, {
    headers: auth(admin.token),
    data: { is_active: false },
  })
}

export async function listTasks(request: APIRequestContext, actor: Account, projectId: string) {
  const response = await request.get(`/api/v1/projects/${projectId}/tasks`, {
    headers: auth(actor.token),
  })
  return (await response.json()).items as { id: string; title: string; status_id: string }[]
}
