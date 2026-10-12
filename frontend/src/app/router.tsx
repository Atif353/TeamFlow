import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { GuestRoute } from '@/components/guards/GuestRoute'
import { ProtectedRoute } from '@/components/guards/ProtectedRoute'
import { RoleGuard } from '@/components/guards/RoleGuard'
import { AppShell } from '@/components/layout/AppShell'
import { env } from '@/config/env'
import { routes } from '@/config/routes'
import {
  AcceptInvitePage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from '@/features/auth'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProjectLayout } from './layouts/ProjectLayout'

function lazyPage<Module, Name extends keyof Module>(
  load: () => Promise<Module>,
  name: Name,
): { lazy: () => Promise<{ Component: ComponentType }> } {
  return {
    lazy: async () => ({ Component: (await load())[name] as ComponentType }),
  }
}

const agile = () => import('@/features/agile')
const admin = () => import('@/features/admin')
const docs = () => import('@/features/docs')
const projects = () => import('@/features/projects')
const tasks = () => import('@/features/tasks')

export const appRoutes = [
  {
    element: <GuestRoute />,
    children: [
      { path: routes.login, element: <LoginPage /> },
      { path: routes.register, element: <RegisterPage /> },
      { path: routes.verifyEmail, element: <VerifyEmailPage /> },
      { path: '/invite/:token', element: <AcceptInvitePage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:token', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to={routes.dashboard} replace /> },
          {
            path: routes.dashboard,
            ...lazyPage(() => import('@/features/dashboard'), 'DashboardPage'),
          },
          { path: routes.projects, ...lazyPage(projects, 'ProjectsPage') },
          {
            path: '/projects/:projectId',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <Navigate to="summary" replace /> },
              { path: 'summary', ...lazyPage(agile, 'SummaryPage') },
              { path: 'timeline', ...lazyPage(agile, 'TimelinePage') },
              { path: 'backlog', ...lazyPage(agile, 'BacklogPage') },
              { path: 'board', ...lazyPage(() => import('@/features/board'), 'BoardPage') },
              { path: 'calendar', ...lazyPage(agile, 'CalendarPage') },
              { path: 'list', ...lazyPage(tasks, 'ListViewPage') },
              { path: 'reports', ...lazyPage(agile, 'ReportsPage') },
              { path: 'docs', ...lazyPage(docs, 'DocsPage') },
              { path: 'docs/:docId', ...lazyPage(docs, 'DocEditorPage') },
              { path: 'members', ...lazyPage(projects, 'MembersPage') },
              { path: 'settings', ...lazyPage(projects, 'SettingsPage') },
            ],
          },
          { path: '/browse/:ref', ...lazyPage(tasks, 'IssuePage') },
          {
            path: routes.notifications,
            ...lazyPage(() => import('@/features/notifications'), 'NotificationsPage'),
          },
          {
            path: routes.profile,
            ...lazyPage(() => import('@/features/profile'), 'ProfilePage'),
          },
          {
            path: '/admin',
            element: <RoleGuard roles={['super_admin']} />,
            children: [
              { index: true, element: <Navigate to="users" replace /> },
              { path: 'users', ...lazyPage(admin, 'AdminUsersPage') },
              { path: 'invitations', ...lazyPage(admin, 'AdminInvitationsPage') },
              { path: 'audit', ...lazyPage(admin, 'AdminAuditPage') },
            ],
          },
          ...(env.isDevelopment
            ? [
                {
                  path: routes.uiShowcase,
                  ...lazyPage(() => import('@/pages/UiShowcasePage'), 'UiShowcasePage'),
                },
              ]
            : []),
        ],
      },
    ],
  },
  { path: routes.forbidden, element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
]

export const routerFuture = { v7_relativeSplatPath: true }

export const router = createBrowserRouter(appRoutes, { future: routerFuture })
