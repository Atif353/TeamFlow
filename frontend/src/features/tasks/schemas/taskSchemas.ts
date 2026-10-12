import { z } from 'zod'
import { parseDuration } from '@/lib/duration'

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'Summary is required').max(200, 'Summary is too long'),
  description: z.string().max(20000, 'Description is too long'),
  issue_type: z.string(),
  status_id: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignee_id: z.string(),
  epic_id: z.string(),
  sprint_id: z.string(),
  version_id: z.string(),
  start_date: z.string(),
  due_date: z.string(),
  story_points: z
    .string()
    .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), {
      message: 'Story points must be a positive number',
    }),
  estimate: z.string().refine((value) => value.trim() === '' || parseDuration(value) !== null, {
    message: 'Use a format like 2d 4h 30m',
  }),
  environment: z.string().max(2000),
})

export type TaskCreateFormValues = z.infer<typeof taskCreateSchema>

export const quickTitleSchema = z.string().trim().min(1).max(200)
