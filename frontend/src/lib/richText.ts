const TAG = /<\/?[a-z][^>]*>/i
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export function isEmptyRichText(value: string): boolean {
  return value.replace(/<[^>]*>/g, '').trim() === '' && !/<img\b/i.test(value)
}

export function toDisplayHtml(value: string): string {
  if (TAG.test(value)) return value
  return value
    .replace(/[&<>"]/g, (character) => ESCAPES[character] ?? character)
    .replace(/\n/g, '<br>')
}
