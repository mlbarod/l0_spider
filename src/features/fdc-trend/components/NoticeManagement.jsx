import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, CircleAlert, ClipboardList, Megaphone, Plus, Send } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import {
  completeNotice,
  createNotice,
  fetchActiveNotices,
  fetchManagedNotices,
} from "../api/noticesApi"

function formatNoticeDate(value) {
  const text = String(value ?? "").trim()
  if (!text) return "일시 확인 불가"
  return text.slice(0, 16).replace("T", " ")
}

export function NoticeManagement() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [confirmingNoticeId, setConfirmingNoticeId] = useState(null)
  const activeNoticesQuery = useQuery({
    queryKey: ["site-notices"],
    queryFn: ({ signal }) => fetchActiveNotices({ signal }),
    staleTime: 30 * 1000,
    retry: false,
  })
  const canManage = activeNoticesQuery.data?.permissions?.canManage === true
  const managedNoticesQuery = useQuery({
    queryKey: ["site-notices", "manage"],
    queryFn: ({ signal }) => fetchManagedNotices({ signal }),
    enabled: open && canManage,
    staleTime: 10 * 1000,
    retry: false,
  })

  const refreshNotices = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["site-notices"], exact: true }),
      queryClient.invalidateQueries({ queryKey: ["site-notices", "manage"], exact: true }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: createNotice,
    onSuccess: async () => {
      setTitle("")
      setBody("")
      await refreshNotices()
      toast.success("공지사항을 등록했습니다.")
    },
    onError: (error) => toast.error(error.message),
  })
  const completeMutation = useMutation({
    mutationFn: completeNotice,
    onSuccess: async () => {
      setConfirmingNoticeId(null)
      await refreshNotices()
      toast.success("공지사항을 완료 처리했습니다.")
    },
    onError: (error) => toast.error(error.message),
  })

  if (!canManage) return null

  const notices = managedNoticesQuery.data?.notices ?? []
  const activeCount = notices.filter((notice) => notice.status === "ACTIVE").length
  const titleLength = title.trim().length
  const bodyLength = body.trim().length
  const canSubmit = titleLength > 0
    && titleLength <= 200
    && bodyLength > 0
    && bodyLength <= 10_000
    && !createMutation.isPending

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!canSubmit) return
    createMutation.mutate({ title: title.trim(), body: body.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-15 justify-start rounded-xl border-primary/20 bg-primary/5 px-4 py-3 text-left shadow-sm hover:bg-primary/10"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Megaphone className="size-4.5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground">관리자 메뉴</span>
            <span className="mt-0.5 block text-sm font-semibold text-foreground">공지 등록</span>
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="border-b bg-primary/5 px-6 pb-5 pt-6">
          <DialogHeader className="pr-8">
            <div className="mb-1 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ClipboardList className="size-4.5" aria-hidden="true" />
              </span>
              <Badge variant="outline" className="border-primary/25 bg-background/80 text-primary">관리자</Badge>
            </div>
            <DialogTitle className="text-xl">공지사항 관리</DialogTitle>
            <DialogDescription>
              신규 공지를 등록하거나 진행중 공지를 완료 처리합니다.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid min-h-0 gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form className="space-y-4 border-b p-5 md:border-b-0 md:border-r" onSubmit={handleSubmit}>
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold">신규 공지 등록</h2>
            </div>

            <div className="space-y-2">
              <label htmlFor="notice-title" className="text-xs font-medium">제목</label>
              <Input
                id="notice-title"
                value={title}
                maxLength={200}
                placeholder="공지 제목을 입력하세요."
                onChange={(event) => setTitle(event.target.value)}
              />
              <p className="text-right text-[11px] text-muted-foreground">{title.length}/200</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="notice-body" className="text-xs font-medium">본문</label>
              <Textarea
                id="notice-body"
                value={body}
                maxLength={10_000}
                rows={10}
                className="min-h-52 resize-y"
                placeholder="사용자에게 표시할 공지 내용을 입력하세요."
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="text-right text-[11px] text-muted-foreground">{body.length.toLocaleString()}/10,000</p>
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              <Send className="size-4" aria-hidden="true" />
              {createMutation.isPending ? "등록 중…" : "신규 등록"}
            </Button>
          </form>

          <section className="min-h-0 p-5" aria-labelledby="notice-list-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="notice-list-title" className="text-sm font-semibold">등록된 공지</h2>
              <Badge variant="secondary">진행중 {activeCount.toLocaleString()}건</Badge>
            </div>

            <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {managedNoticesQuery.isPending ? (
                <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">
                  공지 목록을 불러오는 중입니다…
                </div>
              ) : managedNoticesQuery.isError ? (
                <div className="grid min-h-40 place-items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center">
                  <CircleAlert className="size-6 text-destructive" aria-hidden="true" />
                  <p className="text-sm">공지 목록을 불러오지 못했습니다.</p>
                </div>
              ) : notices.length === 0 ? (
                <div className="grid min-h-40 place-items-center rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  등록된 공지가 없습니다.
                </div>
              ) : notices.map((notice) => {
                const active = notice.status === "ACTIVE"
                const confirming = confirmingNoticeId === notice.noticeId
                return (
                  <article key={notice.noticeId} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-sm font-semibold">{notice.title}</h3>
                          <Badge variant={active ? "default" : "secondary"}>
                            {active ? "진행중" : "완료"}
                          </Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarDays className="size-3" aria-hidden="true" />
                          {formatNoticeDate(notice.createdAt)} · {notice.createdBy}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                      {notice.body}
                    </p>

                    {active ? (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                        {confirming ? (
                          <>
                            <span className="mr-auto text-xs font-medium">완료 처리할까요?</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingNoticeId(null)}
                            >
                              취소
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={completeMutation.isPending}
                              onClick={() => completeMutation.mutate(notice.noticeId)}
                            >
                              <Check className="size-3.5" aria-hidden="true" />
                              완료 확인
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmingNoticeId(notice.noticeId)}
                          >
                            완료 처리
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
                        {formatNoticeDate(notice.completedAt)} · {notice.completedBy || "처리자 확인 불가"}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
