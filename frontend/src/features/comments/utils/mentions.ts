export interface BodySegment {
  text: string
  mention: boolean
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function splitMentions(body: string, names: string[]): BodySegment[] {
  if (names.length === 0) return [{ text: body, mention: false }]
  const alternation = [...names]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|')
  const pattern = new RegExp(`(?<![\\w@])@(?:${alternation})(?!\\w)`, 'gi')
  const segments: BodySegment[] = []
  let cursor = 0
  for (const match of body.matchAll(pattern)) {
    if (match.index > cursor)
      segments.push({ text: body.slice(cursor, match.index), mention: false })
    segments.push({ text: match[0], mention: true })
    cursor = match.index + match[0].length
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor), mention: false })
  return segments
}

export interface MentionQuery {
  query: string
  start: number
}

const TRIGGER = /(^|\s)@([^@\n]{0,30})$/

export function activeMentionQuery(text: string, caret: number): MentionQuery | null {
  const match = TRIGGER.exec(text.slice(0, caret))
  if (!match) return null
  const prefix = match[1] ?? ''
  return { query: match[2] ?? '', start: match.index + prefix.length }
}

export function insertMention(text: string, caret: number, start: number, name: string) {
  const inserted = `@${name} `
  const next = text.slice(0, start) + inserted + text.slice(caret)
  return { text: next, caret: start + inserted.length }
}
