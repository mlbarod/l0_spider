import { Mark } from "@tiptap/react"
import { isQnaFontSize, QNA_DEFAULT_FONT_SIZE } from "./fontSizes.mjs"

export const QnaFontSize = Mark.create({
  name: "qnaFontSize",
  addAttributes() {
    return {
      size: {
        default: QNA_DEFAULT_FONT_SIZE,
        parseHTML: (element) => Number(element.getAttribute("data-qna-font-size")),
        renderHTML: ({ size }) => isQnaFontSize(size) ? { "data-qna-font-size": String(size) } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: "span[data-qna-font-size]", getAttrs: (element) => isQnaFontSize(element.getAttribute("data-qna-font-size")) ? null : false }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0]
  },
})

// 기본 크기도 저장해 조회·메일·재편집에서 같은 크기를 표시한다.
export function fontSizedHtml(editor) {
  return `<div data-qna-font-size="${QNA_DEFAULT_FONT_SIZE}">${editor.getHTML()}</div>`
}
