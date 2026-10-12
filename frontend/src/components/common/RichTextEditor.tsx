import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/cn'

interface ToolButtonProps {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolButton({ icon: Icon, label, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-surface-muted disabled:opacity-40',
        active && 'bg-primary-100 text-primary-text',
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      quote: current.isActive('blockquote'),
      code: current.isActive('codeBlock'),
      link: current.isActive('link'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  })
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')
    if (url === null) return
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5"
    >
      <ToolButton
        icon={Bold}
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="Underline"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <ToolButton
        icon={Heading2}
        label="Heading 2"
        active={state.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={Heading3}
        label="Heading 3"
        active={state.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolButton
        icon={List}
        label="Bullet list"
        active={state.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        icon={Quote}
        label="Quote"
        active={state.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        icon={Code2}
        label="Code block"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolButton icon={LinkIcon} label="Link" active={state.link} onClick={setLink} />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <ToolButton
        icon={Undo2}
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  )
}

interface RichTextEditorProps {
  content: string
  editable: boolean
  onChange: (html: string) => void
}

export function RichTextEditor({ content, editable, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    editorProps: {
      attributes: {
        'aria-label': 'Document content',
        class: 'doc-prose min-h-[320px] px-4 py-3 outline-none',
      },
    },
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {editor && editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}
