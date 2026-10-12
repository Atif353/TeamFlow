import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*/api/v1/health', () => HttpResponse.json({ status: 'ok', database: 'up' })),
  http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
  http.get('*/api/v1/notifications', () =>
    HttpResponse.json({ items: [], total: 0, page: 1, page_size: 20 }),
  ),
]
