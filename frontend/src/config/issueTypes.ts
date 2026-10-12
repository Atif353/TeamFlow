import {
  Bookmark,
  Bug,
  CheckSquare,
  FlaskConical,
  GitMerge,
  Lightbulb,
  ListTree,
  Siren,
  Sparkles,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export type IssueType =
  | 'epic'
  | 'story'
  | 'task'
  | 'bug'
  | 'subtask'
  | 'feature'
  | 'improvement'
  | 'merge_request'
  | 'incident'
  | 'spike'
  | 'test'

interface IssueTypeMeta {
  label: string
  description: string
  color: string
  icon: LucideIcon
}

export const ISSUE_TYPE_META: Record<IssueType, IssueTypeMeta> = {
  epic: {
    label: 'Epic',
    description: 'A large body of work that groups stories and tasks',
    color: '#8B5CF6',
    icon: Zap,
  },
  story: {
    label: 'Story',
    description: 'A user-facing piece of functionality',
    color: '#10B981',
    icon: Bookmark,
  },
  task: {
    label: 'Task',
    description: 'A piece of work that needs to be done',
    color: '#0EA5E9',
    icon: CheckSquare,
  },
  bug: {
    label: 'Bug',
    description: 'Something that is broken and needs fixing',
    color: '#F43F5E',
    icon: Bug,
  },
  subtask: {
    label: 'Subtask',
    description: 'A smaller step within another issue',
    color: '#64748B',
    icon: ListTree,
  },
  feature: {
    label: 'Feature',
    description: 'A new capability for the product',
    color: '#6366F1',
    icon: Sparkles,
  },
  improvement: {
    label: 'Improvement',
    description: 'An enhancement to an existing capability',
    color: '#14B8A6',
    icon: TrendingUp,
  },
  merge_request: {
    label: 'Merge request',
    description: 'Code change waiting for review and merge',
    color: '#F59E0B',
    icon: GitMerge,
  },
  incident: {
    label: 'Incident',
    description: 'A production problem needing urgent attention',
    color: '#DC2626',
    icon: Siren,
  },
  spike: {
    label: 'Spike',
    description: 'Time-boxed research or investigation',
    color: '#EC4899',
    icon: Lightbulb,
  },
  test: {
    label: 'Test',
    description: 'A test case or QA activity',
    color: '#84CC16',
    icon: FlaskConical,
  },
}

export const CREATABLE_ISSUE_TYPES: IssueType[] = [
  'task',
  'story',
  'bug',
  'epic',
  'feature',
  'improvement',
  'merge_request',
  'incident',
  'spike',
  'test',
]

export const LINK_TYPE_LABELS = {
  blocks: 'blocks',
  duplicates: 'duplicates',
  relates_to: 'relates to',
  clones: 'clones',
} as const

export type LinkType = keyof typeof LINK_TYPE_LABELS
