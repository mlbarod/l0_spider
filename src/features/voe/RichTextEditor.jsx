import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { TableKit } from "@tiptap/extension-table"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Table2,
  Undo2,
} from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { QnaFontSize, fontSizedHtml } from "./fontSize"
import { QNA_FONT_SIZES, QNA_DEFAULT_FONT_SIZE } from "./fontSizes.mjs"

function ToolbarButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "grid size-8 place-items-center rounded-[6px] bg-transparent text-[#5f666c] outline-none transition hover:bg-[#eef6fc] hover:text-[#0673bc] focus-visible:ring-[3px] focus-visible:ring-[rgba(7,136,223,.18)] disabled:opacity-35",
            active && "bg-[#e2f2fd] text-[#0673bc]",
          )}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="z-[140]">{label}</TooltipContent>
    </Tooltip>
  )
}

export function RichTextEditor({
  initialContent = "",
  onChange,
  error,
  ariaLabel = "질문 본문 편집기",
  toolbarLabel = "본문 서식 도구",
  placeholder = "문의 배경과 확인이 필요한 내용을 구체적으로 작성해 주세요.",
  compact = false,
}) {
  const imageInputRef = useRef(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkValue, setLinkValue] = useState("")

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      QnaFontSize,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image.configure({ allowBase64: true, HTMLAttributes: { class: "qna-editor-image" } }),
      TableKit.configure({
        table: { resizable: true, HTMLAttributes: { class: "qna-editor-table" } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn("qna-prosemirror", compact && "qna-prosemirror-compact"),
        role: "textbox",
        "aria-label": ariaLabel,
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange?.(fontSizedHtml(currentEditor), currentEditor.getText()),
  })

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      fontSize: currentEditor?.getAttributes("qnaFontSize").size ?? QNA_DEFAULT_FONT_SIZE,
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      blockquote: currentEditor?.isActive("blockquote") ?? false,
      link: currentEditor?.isActive("link") ?? false,
      canUndo: currentEditor?.can().chain().focus().undo().run() ?? false,
      canRedo: currentEditor?.can().chain().focus().redo().run() ?? false,
    }),
  })

  const applyLink = () => {
    const href = linkValue.trim()
    if (!editor || !href) return
    const normalizedHref = /^https?:\/\//i.test(href) ? href : `https://${href}`
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run()
    setLinkValue("")
    setShowLinkInput(false)
  }

  const handleImage = (event) => {
    const [file] = event.target.files ?? []
    if (!file || !editor) return
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      editor.chain().focus().setImage({ src: String(reader.result), alt: file.name, title: file.name }).run()
    })
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  return (
    <div className={cn("qna-rich-editor overflow-hidden rounded-[10px] border bg-white transition", error ? "border-[#c96861]" : "border-[#d5e3ec] focus-within:border-[#6ec0f7] focus-within:ring-[3px] focus-within:ring-[rgba(7,136,223,.1)]")}>
      <TooltipProvider delayDuration={350}>
        <div className="flex min-h-11 flex-wrap items-center gap-0.5 border-b border-[#e3ebf0] bg-[#fafbfa] px-2 py-1.5" role="toolbar" aria-label={toolbarLabel}>
          <label className="mr-2 flex items-center gap-2 text-[14px] text-[#263b4a]">
            글씨 크기
            <select aria-label="글씨 크기" className="h-9 rounded-md border border-[#d5e3ec] bg-white px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-[#0673bc]" value={editorState.fontSize} disabled={!editor} onChange={(event) => editor?.chain().focus().setMark("qnaFontSize", { size: Number(event.target.value) }).run()}>
              {QNA_FONT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <span>pt</span>
          </label>
          <ToolbarButton label="굵게" active={editorState.bold} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="size-4" /></ToolbarButton>
          <ToolbarButton label="기울임" active={editorState.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="size-4" /></ToolbarButton>
          <span className="mx-1 h-5 w-px bg-[#d5e3ec]" aria-hidden="true" />
          <ToolbarButton label="글머리 기호" active={editorState.bulletList} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="size-4" /></ToolbarButton>
          <ToolbarButton label="번호 목록" active={editorState.orderedList} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></ToolbarButton>
          <ToolbarButton label="인용" active={editorState.blockquote} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote className="size-4" /></ToolbarButton>
          <span className="mx-1 h-5 w-px bg-[#d5e3ec]" aria-hidden="true" />
          <ToolbarButton label="링크" active={editorState.link} onClick={() => setShowLinkInput((current) => !current)}><Link2 className="size-4" /></ToolbarButton>
          <ToolbarButton label="3×3 표 삽입" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()}><Table2 className="size-4" /></ToolbarButton>
          <ToolbarButton label="이미지 삽입" onClick={() => imageInputRef.current?.click()}><ImagePlus className="size-4" /></ToolbarButton>
          <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="본문 이미지 선택" onChange={handleImage} />
          <span className="mx-1 h-5 w-px bg-[#d5e3ec]" aria-hidden="true" />
          <ToolbarButton label="실행 취소" disabled={!editorState.canUndo} onClick={() => editor?.chain().focus().undo().run()}><Undo2 className="size-4" /></ToolbarButton>
          <ToolbarButton label="다시 실행" disabled={!editorState.canRedo} onClick={() => editor?.chain().focus().redo().run()}><Redo2 className="size-4" /></ToolbarButton>
        </div>
      </TooltipProvider>

      {showLinkInput ? (
        <div className="flex items-center gap-2 border-b border-[#e3ebf0] bg-[#f1f6f9] px-3 py-2">
          <Input
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                applyLink()
              }
              if (event.key === "Escape") setShowLinkInput(false)
            }}
            className="h-8"
            placeholder="https://intranet.example"
            aria-label="연결할 URL"
            autoFocus
          />
          <Button type="button" size="sm" onClick={applyLink}>적용</Button>
          {editorState.link ? <Button type="button" size="sm" variant="ghost" onClick={() => editor?.chain().focus().unsetLink().run()}>해제</Button> : null}
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  )
}
