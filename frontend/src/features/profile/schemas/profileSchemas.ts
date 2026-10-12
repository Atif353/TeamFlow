import { z } from 'zod'
import { nameSchema, passwordSchema } from '@/features/auth/schemas/authSchemas'

export const profileSchema = z.object({ name: nameSchema })

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  })

export type ProfileInput = z.infer<typeof profileSchema>
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>
