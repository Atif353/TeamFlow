import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/axios'
import { positionBetween } from '@/lib/positions'
import {
  addChecklistItem,
  bulkTasks,
  cloneTask,
  createTask,
  deleteChecklistItem,
  deleteTask,
  fetchActivity,
  fetchAllTasks,
  fetchTask,
  fetchTasks,
  moveTask,
  rankTask,
  setWatching,
  updateChecklistItem,
  updateTask,
} from '../api/tasksApi'
import type {
  Task,
  TaskCreateInput,
  TaskListParams,
  TaskMoveInput,
  TaskRankInput,
  TaskUpdateInput,
} from '../types'

export const taskKeys = {
  project: (projectId: string) => ['tasks', projectId] as const,
  list: (projectId: string, params: TaskListParams) =>
    ['tasks', projectId, 'list', params] as const,
  boardRoot: (projectId: string) => ['tasks', projectId, 'board'] as const,
  board: (projectId: string, scope: string) => ['tasks', projectId, 'board', scope] as const,
  all: (projectId: string, params: TaskListParams) => ['tasks', projectId, 'all', params] as const,
  subtasks: (projectId: string, parentId: string) =>
    ['tasks', projectId, 'subtasks', parentId] as const,
  children: (projectId: string, epicId: string) =>
    ['tasks', projectId, 'children', epicId] as const,
  detail: (ref: string) => ['task', ref] as const,
  activity: (taskId: string) => ['task', taskId, 'activity'] as const,
}

export function invalidateProject(client: QueryClient, projectId: string) {
  for (const root of ['tasks', 'backlog', 'summary', 'reports', 'sprints', 'versions']) {
    void client.invalidateQueries({ queryKey: [root, projectId] })
  }
  void client.invalidateQueries({ queryKey: ['dashboard'] })
  void client.invalidateQueries({ queryKey: ['projects', 'list'] })
  void client.invalidateQueries({ queryKey: ['projects', 'detail', projectId], exact: true })
}

export function invalidateTaskDetail(client: QueryClient, taskId: string) {
  void client.invalidateQueries({
    queryKey: ['task'],
    predicate: (query) =>
      query.queryKey.length === 2 && (query.state.data as Task | undefined)?.id === taskId,
  })
  void client.invalidateQueries({ queryKey: taskKeys.activity(taskId) })
}

function invalidateTask(client: QueryClient, projectId: string, task?: Pick<Task, 'id' | 'key'>) {
  invalidateProject(client, projectId)
  if (task) {
    void client.invalidateQueries({ queryKey: taskKeys.detail(task.id) })
    void client.invalidateQueries({ queryKey: taskKeys.detail(task.key) })
    invalidateTaskDetail(client, task.id)
  }
}

export function useTaskList(projectId: string, params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(projectId, params),
    queryFn: () => fetchTasks(projectId, params),
    placeholderData: keepPreviousData,
  })
}

export function useAllTasks(projectId: string, params: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: taskKeys.all(projectId, params),
    queryFn: () => fetchAllTasks(projectId, params),
    enabled,
  })
}

export function useBoardTasks(projectId: string, scope = 'all', params: TaskListParams = {}) {
  return useQuery({
    queryKey: taskKeys.board(projectId, scope),
    queryFn: () => fetchAllTasks(projectId, { exclude_epics: true, ...params }),
  })
}

export function useSubtasks(projectId: string, parentId: string) {
  return useQuery({
    queryKey: taskKeys.subtasks(projectId, parentId),
    queryFn: () => fetchTasks(projectId, { parent_id: parentId, page_size: 100 }),
  })
}

export function useEpicChildren(projectId: string, epicId: string, enabled: boolean) {
  return useQuery({
    queryKey: taskKeys.children(projectId, epicId),
    queryFn: () =>
      fetchTasks(projectId, { epic_id: epicId, include_subtasks: true, page_size: 100 }),
    enabled,
  })
}

export function useTask(ref: string | null) {
  const client = useQueryClient()
  return useQuery({
    queryKey: taskKeys.detail(ref ?? ''),
    queryFn: async () => {
      const task = await fetchTask(ref as string)
      client.setQueryData(taskKeys.detail(task.id), task)
      client.setQueryData(taskKeys.detail(task.key), task)
      return task
    },
    enabled: Boolean(ref),
    retry: false,
  })
}

export function useActivity(taskId: string) {
  return useQuery({ queryKey: taskKeys.activity(taskId), queryFn: () => fetchActivity(taskId) })
}

export function useCreateTask(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskCreateInput) => createTask(projectId, input),
    onSuccess: (task) => {
      client.setQueryData(taskKeys.detail(task.id), task)
      client.setQueryData(taskKeys.detail(task.key), task)
      invalidateProject(client, projectId)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

interface UpdateVariables {
  taskId: string
  changes: TaskUpdateInput
  optimistic?: Partial<Task>
}

interface RollbackContext {
  details: [readonly unknown[], Task | undefined][]
  boards: [readonly unknown[], Task[] | undefined][]
}

function detailQueries(client: QueryClient, taskId: string) {
  return client
    .getQueriesData<Task>({ queryKey: ['task'] })
    .filter(([key, data]) => key.length === 2 && data?.id === taskId)
}

function patchBoards(client: QueryClient, projectId: string, apply: (task: Task) => Task) {
  client.setQueriesData<Task[]>({ queryKey: taskKeys.boardRoot(projectId) }, (old) =>
    old?.map(apply),
  )
}

function snapshotBoards(client: QueryClient, projectId: string) {
  return client.getQueriesData<Task[]>({ queryKey: taskKeys.boardRoot(projectId) })
}

function restoreSnapshots(client: QueryClient, context: RollbackContext) {
  for (const [key, data] of [...context.boards, ...context.details]) client.setQueryData(key, data)
}

export function useUpdateTask(projectId: string) {
  const client = useQueryClient()
  return useMutation<Task, Error, UpdateVariables, RollbackContext>({
    mutationFn: ({ taskId, changes }) => updateTask(taskId, changes),
    onMutate: async ({ taskId, changes, optimistic }) => {
      await client.cancelQueries({ queryKey: taskKeys.project(projectId) })
      await client.cancelQueries({ queryKey: taskKeys.detail(taskId) })
      const patch: Partial<Task> = { ...(changes as Partial<Task>), ...optimistic }
      const apply = (task: Task) => (task.id === taskId ? { ...task, ...patch } : task)
      const details = detailQueries(client, taskId)
      const context: RollbackContext = { details, boards: snapshotBoards(client, projectId) }
      for (const [key, data] of details) client.setQueryData<Task>(key, data && apply(data))
      client.setQueryData<Task>(taskKeys.detail(taskId), (old) => old && apply(old))
      patchBoards(client, projectId, apply)
      return context
    },
    onError: (error, _variables, context) => {
      if (context) restoreSnapshots(client, context)
      toast.error(errorMessage(error))
    },
    onSettled: (data, _error, { taskId }) =>
      invalidateTask(client, projectId, data ?? { id: taskId, key: taskId }),
  })
}

interface MoveVariables extends TaskMoveInput {
  taskId: string
}

export function useMoveTask(projectId: string) {
  const client = useQueryClient()
  return useMutation<Task, Error, MoveVariables, RollbackContext>({
    mutationFn: ({ taskId, ...input }) => moveTask(taskId, input),
    onMutate: async ({ taskId, status_id, previous_task_id, next_task_id }) => {
      await client.cancelQueries({ queryKey: taskKeys.project(projectId) })
      const boards = snapshotBoards(client, projectId)
      const flat = boards.flatMap(([, data]) => data ?? [])
      const positionOf = (id: string | null) =>
        id === null ? null : (flat.find((task) => task.id === id)?.position ?? null)
      const position = positionBetween(positionOf(previous_task_id), positionOf(next_task_id))
      patchBoards(client, projectId, (task) =>
        task.id === taskId ? { ...task, status_id, position } : task,
      )
      return { boards, details: detailQueries(client, taskId) }
    },
    onError: (error, _variables, context) => {
      if (context) restoreSnapshots(client, context)
      toast.error(errorMessage(error))
    },
    onSettled: (data, _error, { taskId }) =>
      invalidateTask(client, projectId, data ?? { id: taskId, key: taskId }),
  })
}

export function useRankTask(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, ...input }: TaskRankInput & { taskId: string }) =>
      rankTask(taskId, input),
    onSettled: () => invalidateProject(client, projectId),
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDeleteTask(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (_data, taskId) => {
      client.removeQueries({ queryKey: taskKeys.detail(taskId) })
      invalidateProject(client, projectId)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useWatch(projectId: string, taskId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (watching: boolean) => setWatching(taskId, watching),
    onSuccess: (task) => {
      client.setQueryData(taskKeys.detail(task.id), task)
      client.setQueryData(taskKeys.detail(task.key), task)
      void client.invalidateQueries({ queryKey: taskKeys.project(projectId) })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useChecklist(projectId: string, taskId: string) {
  const client = useQueryClient()
  const onSuccess = (task: Task) => {
    client.setQueryData(taskKeys.detail(task.id), task)
    client.setQueryData(taskKeys.detail(task.key), task)
    void client.invalidateQueries({ queryKey: taskKeys.project(projectId) })
  }
  const onError = (error: unknown) => toast.error(errorMessage(error))
  return {
    add: useMutation({
      mutationFn: (text: string) => addChecklistItem(taskId, text),
      onSuccess,
      onError,
    }),
    toggle: useMutation({
      mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
        updateChecklistItem(taskId, itemId, { done }),
      onSuccess,
      onError,
    }),
    remove: useMutation({
      mutationFn: (itemId: string) => deleteChecklistItem(taskId, itemId),
      onSuccess,
      onError,
    }),
  }
}

export function useBulkTasks(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      taskIds,
      action,
    }: {
      taskIds: string[]
      action: { changes: TaskUpdateInput } | { delete: true }
    }) => bulkTasks(projectId, taskIds, action),
    onSettled: () => invalidateProject(client, projectId),
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useCloneTask(projectId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: cloneTask,
    onSuccess: () => invalidateProject(client, projectId),
    onError: (error) => toast.error(errorMessage(error)),
  })
}
