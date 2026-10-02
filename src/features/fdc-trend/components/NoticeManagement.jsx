import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, CircleAlert, ClipboardList, Megaphone, Pencil, Plus, Send } from "lucide-react"
import { useRef, useState } from "react"
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
  fetchManagedNotices,
  fetchNoticePermissions,
  updateNotice,
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
  const [editingNoticeId, setEditingNoticeId] = useState(null)
  const titleInputRef = useRef(null)
  const [confirmingNoticeId, setConfirmingNoticeId] = useState(null)
  const permissionQuery = useQuery({
    queryKey: ["site-notice-permissions"],
    queryFn: ({ signal }) => fetchNoticePermissions({ signal }),
    staleTime: 30 * 1000,
    retry: false,
  })
  const canManage = permissionQuery.data?.permissions?.canManage === true
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

  const resetForm = () => {
    setEditingNoticeId(null)
    setTitle("")
    setBody("")
  }
  const saveMutation = useMutation({
    mutationFn: (payload) => payload.noticeId === undefined ? createNotice(payload) : updateNotice(payload),
    onSuccess: async (_result, payload) => {
      resetForm()
      await refreshNotices()
      toast.success(payload.noticeId === undefined ? "공지사항을 등록했습니다." : "공지사항을 수정했습니다.")
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
  const busy = saveMutation.isPending || completeMutation.isPending
  const canSubmit = titleLength > 0
    && titleLength <= 200
    && bodyLength > 0
    && bodyLength <= 10_000
    && !busy

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!canSubmit) return
    saveMutation.mutate({
      ...(editingNoticeId === null ? {} : { noticeId: editingNoticeId }),
      title: title.trim(),
      body: body.trim(),
    })
  }

  const handleEdit = (notice) => {
    setEditingNoticeId(notice.noticeId)
    setTitle(notice.title)
    setBody(notice.body)
    setConfirmingNoticeId(null)
    titleInputRef.current?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 justify-start rounded-full border-0 bg-[#fafafc] px-4 py-2 text-left shadow-none hover:bg-[#f5f5f7]"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d2d2d7]/55 text-[#0066cc]">
            <Megaphone className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[10px] font-normal tracking-[-0.08px] text-[#7a7a7a]">관리자 메뉴</span>
            <span className="block text-xs font-semibold text-[#1d1d1f]">공지 등록</span>
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-3xl border-[#e8e8ed] bg-white p-0 text-[#1d1d1f] shadow-xl sm:max-w-4xl">
        <div className="shrink-0 border-b border-[#e8e8ed] px-6 pb-5 pt-6">
          <DialogHeader className="pr-8 text-left">
            <div className="mb-1 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-[#f5f5f7] text-[#0066cc]">
                <ClipboardList className="size-4.5" aria-hidden="true" />
              </span>
              <Badge variant="outline" className="rounded-full border-0 bg-[#f5f5f7] text-[#6e6e73]">관리자</Badge>
            </div>
            <DialogTitle className="text-xl tracking-tight">공지사항 관리</DialogTitle>
            <DialogDescription className="text-[#6e6e73]">
              공지를 등록·수정하거나 진행중 공지를 완료 처리합니다.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid min-h-0 gap-0 overflow-y-auto md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form className="space-y-4 border-b border-[#e8e8ed] p-5 md:border-b-0 md:border-r" onSubmit={handleSubmit}>
            <div className="flex items-center gap-2">
              {editingNoticeId === null ? <Plus className="size-4 text-[#0066cc]" aria-hidden="true" /> : <Pencil className="size-4 text-[#0066cc]" aria-hidden="true" />}
              <h2 className="text-sm font-semibold">{editingNoticeId === null ? "신규 공지 등록" : "공지 수정"}</h2>
            </div>

            <div className="space-y-2">
              <label htmlFor="notice-title" className="text-xs font-medium">제목</label>
              <Input
                id="notice-title"
                className="rounded-xl border-[#d2d2d7] focus-visible:border-[#0066cc] focus-visible:ring-[#0066cc]/20"
                ref={titleInputRef}
                disabled={busy}
                value={title}
                maxLength={200}
                placeholder="공지 제목을 입력하세요."
                onChange={(event) => setTitle(event.target.value)}
              />
              <p className="text-right text-[11px] text-[#6e6e73]">{title.length}/200</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="notice-body" className="text-xs font-medium">본문</label>
              <Textarea
                id="notice-body"
                disabled={busy}
                value={body}
                maxLength={10_000}
                rows={10}
                className="min-h-52 resize-y rounded-xl border-[#d2d2d7] focus-visible:border-[#0066cc] focus-visible:ring-[#0066cc]/20"
                placeholder="사용자에게 표시할 공지 내용을 입력하세요."
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="text-right text-[11px] text-[#6e6e73]">{body.length.toLocaleString()}/10,000</p>
            </div>

            <Button type="submit" className="w-full rounded-full bg-[#0066cc] text-white hover:bg-[#0071e3]" disabled={!canSubmit}>
              <Send className="size-4" aria-hidden="true" />
              {saveMutation.isPending ? "저장 중…" : editingNoticeId === null ? "신규 등록" : "수정 저장"}
            </Button>
            {editingNoticeId !== null ? (
              <Button type="button" variant="outline" className="w-full rounded-full" disabled={busy} onClick={resetForm}>
                수정 취소
              </Button>
            ) : null}
          </form>

          <section className="min-h-0 bg-[#f5f5f7] p-5" aria-labelledby="notice-list-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="notice-list-title" className="text-sm font-semibold">등록된 공지</h2>
              <Badge variant="secondary" className="rounded-full bg-[#e8e8ed] text-[#6e6e73]">진행중 {activeCount.toLocaleString()}건</Badge>
            </div>

            <div className="mt-4 space-y-3 md:max-h-[430px] md:overflow-y-auto md:pr-1">
              {managedNoticesQuery.isPending ? (
                <div className="grid min-h-40 place-items-center text-sm text-[#6e6e73]">
                  공지 목록을 불러오는 중입니다…
                </div>
              ) : managedNoticesQuery.isError ? (
                <div className="grid min-h-40 place-items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center">
                  <CircleAlert className="size-6 text-destructive" aria-hidden="true" />
                  <p className="text-sm">공지 목록을 불러오지 못했습니다.</p>
                </div>
              ) : notices.length === 0 ? (
                <div className="grid min-h-40 place-items-center rounded-xl border border-dashed p-5 text-sm text-[#6e6e73]">
                  등록된 공지가 없습니다.
                </div>
              ) : notices.map((notice) => {
                const active = notice.status === "ACTIVE"
                const confirming = confirmingNoticeId === notice.noticeId
                return (
                  <article key={notice.noticeId} className={`rounded-2xl border p-4 ${editingNoticeId === notice.noticeId ? "border-[#0066cc]/40 bg-[#0066cc]/5" : "border-[#e8e8ed] bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-sm font-semibold">{notice.title}</h3>
                          <Badge variant="secondary" className={`rounded-full ${active ? "bg-[#0066cc]/10 text-[#0066cc]" : "bg-[#f5f5f7] text-[#6e6e73]"}`}>
                            {active ? "진행중" : "완료"}
                          </Badge>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#6e6e73]">
                          <CalendarDays className="size-3" aria-hidden="true" />
                          {formatNoticeDate(notice.createdAt)} · {notice.createdBy}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-[#6e6e73]">
                      {notice.body}
                    </p>

                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="outline" size="sm" className="rounded-full border-[#d2d2d7] text-[#0066cc] hover:bg-[#f5f5f7]" disabled={busy} onClick={() => handleEdit(notice)}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        {editingNoticeId === notice.noticeId ? "수정 중" : "수정"}
                      </Button>
                    </div>
                    {active ? (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                        {confirming ? (
                          <>
                            <span className="mr-auto text-xs font-medium">완료 처리할까요?</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => setConfirmingNoticeId(null)}
                            >
                              취소
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full bg-[#0066cc] text-white hover:bg-[#0071e3]"
                              size="sm"
                              disabled={busy}
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
                            className="rounded-full border-[#d2d2d7] hover:bg-[#f5f5f7]"
                            size="sm"
                            disabled={busy || editingNoticeId === notice.noticeId}
                            onClick={() => setConfirmingNoticeId(notice.noticeId)}
                          >
                            완료 처리
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 border-t pt-3 text-[11px] text-[#6e6e73]">
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
