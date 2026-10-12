import { useState } from 'react'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { isEmptyRichText, toDisplayHtml } from '@/lib/richText'

interface TaskDescriptionProps {
  value: string
  editable: boolean
  onSave: (description: string) => void
  title?: string
  emptyText?: string
  rich?: boolean
}

export function TaskDescription({
  value,
  editable,
  onSave,
  title = 'Description',
  emptyText = 'No description.',
  rich = true,
}: TaskDescriptionProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const empty = rich ? isEmptyRichText(value) : value.trim() === ''

  const save = () => {
    onSave(rich && isEmptyRichText(draft) ? '' : draft)
    setEditing(false)
  }

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        {editable && !editing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(value)
              setEditing(true)
            }}
          >
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <>
          {rich ? (
            <RichTextEditor content={toDisplayHtml(value)} editable onChange={setDraft} />
          ) : (
            <Textarea
              aria-label={title}
              rows={5}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : rich ? (
        <div
          className="doc-prose break-words"
          dangerouslySetInnerHTML={{ __html: toDisplayHtml(value) }}
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{value}</p>
      )}
    </section>
  )
}
