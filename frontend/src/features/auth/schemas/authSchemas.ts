import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email')

export const nameSchema = z.string().trim().min(1, 'Name is required').max(80, 'Name is too long')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  workspace_name: z.string().trim().max(80, 'Workspace name is too long').optional(),
  password: passwordSchema,
})

export const acceptInviteSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z.object({ password: passwordSchema })

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
