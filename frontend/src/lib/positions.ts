export const POSITION_STEP = 1024

export function positionBetween(previous: number | null, following: number | null): number {
  if (previous === null && following === null) return POSITION_STEP
  if (previous === null) return (following as number) - POSITION_STEP
  if (following === null) return previous + POSITION_STEP
  return (previous + following) / 2
}
