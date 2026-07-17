import { useMemo } from "react"
import DOMPurify from "dompurify"
import { ArrowLeft, BookOpen } from "lucide-react"
import { marked } from "marked"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import manualMarkdown from "../../../../docs/user-manual/USER_MANUAL.md?raw"

const manualImageModules = import.meta.glob(
  [
    "../../../../docs/user-manual/images/*.png",
    "!../../../../docs/user-manual/images/13-history.png",
  ],
  { eager: true, import: "default", query: "?url" },
)

const manualImageUrls = Object.fromEntries(
  Object.entries(manualImageModules).map(([path, url]) => [path.split("/").pop(), url]),
)

function slugifyHeading(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&[^;]+;/g, "")
    .trim()
    .toLowerCase()
    .replace(/[·.,:()[\]{}'"`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

function buildManualHtml() {
  const markdownWithImages = manualMarkdown.replace(
    /\]\(images\/([^)]+)\)/g,
    (match, fileName) => {
      const imageUrl = manualImageUrls[fileName]
      return imageUrl ? `](${imageUrl})` : match
    },
  )
  const html = marked.parse(markdownWithImages)
  const htmlWithHeadingIds = html.replace(
    /<h([1-6])>(.*?)<\/h\1>/gs,
    (_, depth, content) => `<h${depth} id="${slugifyHeading(content)}">${content}</h${depth}>`,
  )

  return DOMPurify.sanitize(htmlWithHeadingIds)
}

export function UserManualPage() {
  const manualHtml = useMemo(buildManualHtml, [])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <header className="shrink-0 border-b bg-card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="size-6 text-primary" aria-hidden="true" />
              <h1 className="truncate text-2xl font-semibold tracking-tight">사용자 메뉴얼</h1>
              <Badge variant="outline">PC Manual</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              SPIDER의 메뉴, 조회 조건, 차트와 작업 버튼 사용 방법을 확인합니다.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              SPIDER 메인
            </Link>
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <article
          className="mx-auto max-w-6xl rounded-2xl border bg-card px-8 py-10 shadow-sm
            [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline
            [&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-primary/5 [&_blockquote]:px-4 [&_blockquote]:py-3
            [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]
            [&_h1]:mb-6 [&_h1]:border-b [&_h1]:pb-4 [&_h1]:text-3xl [&_h1]:font-bold
            [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:scroll-mt-6 [&_h2]:border-b [&_h2]:pb-3 [&_h2]:text-2xl [&_h2]:font-semibold
            [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:scroll-mt-6 [&_h3]:text-xl [&_h3]:font-semibold
            [&_h4]:mb-2 [&_h4]:mt-6 [&_h4]:scroll-mt-6 [&_h4]:text-base [&_h4]:font-semibold
            [&_hr]:my-10 [&_hr]:border-border
            [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:shadow-sm
            [&_li]:my-1.5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-7
            [&_p]:my-3 [&_p]:text-sm [&_p]:leading-7 [&_p]:text-foreground/90
            [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4
            [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
            [&_tbody_tr:nth-child(even)]:bg-muted/30 [&_td]:border [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top
            [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold
            [&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-7"
          dangerouslySetInnerHTML={{ __html: manualHtml }}
        />
      </main>
    </div>
  )
}
