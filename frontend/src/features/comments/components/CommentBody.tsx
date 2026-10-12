import { useMemo } from 'react'
import { splitMentions } from '../utils/mentions'

interface CommentBodyProps {
  body: string
  mentionNames: string[]
}

export function CommentBody({ body, mentionNames }: CommentBodyProps) {
  const segments = useMemo(() => splitMentions(body, mentionNames), [body, mentionNames])
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
      {segments.map((segment, index) =>
        segment.mention ? (
          <mark
            key={index}
            data-testid="mention"
            className="rounded bg-primary-100 px-1 font-medium text-primary-text"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  )
}
