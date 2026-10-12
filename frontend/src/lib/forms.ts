import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toApiError } from './axios'

export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): string | null {
  const apiError = toApiError(error)
  let matched = false
  for (const [field, message] of Object.entries(apiError.details)) {
    if (knownFields.includes(field)) {
      setError(field as Path<T>, { message })
      matched = true
    }
  }
  return matched ? null : apiError.message
}
