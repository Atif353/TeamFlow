import { z } from 'zod'

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a valid color')

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  key: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9]{1,9}$/, 'Use 2–10 letters or digits, starting with a letter'),
  description: z.string().max(2000, 'Description is too long'),
  color: hexColorSchema,
})

export const projectEditSchema = projectSchema.omit({ key: true })

export const labelSchema = z.object({
  name: z.string().trim().min(1, 'Label name is required').max(30, 'Label name is too long'),
  color: hexColorSchema,
})

export type ProjectInput = z.infer<typeof projectSchema>
export type ProjectEditInput = z.infer<typeof projectEditSchema>
export type LabelInput = z.infer<typeof labelSchema>
