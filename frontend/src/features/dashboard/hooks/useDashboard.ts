import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { Dashboard } from '../types'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<Dashboard>('/dashboard/me')).data,
  })
}
