import { useQuery } from '@tanstack/react-query'
import { fetchWorkspaceMembers } from '../api/workspaceApi'

export function useWorkspaceMembers(enabled = true) {
  return useQuery({
    queryKey: ['workspace', 'members'],
    queryFn: fetchWorkspaceMembers,
    enabled,
  })
}
