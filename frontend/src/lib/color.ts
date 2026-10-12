export function readableOn(color: string): string {
  return `color-mix(in srgb, ${color} 55%, rgb(var(--foreground)))`
}
