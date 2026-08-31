import { useQuery } from "@tanstack/react-query"
import { Bell, CalendarDays, CircleAlert, Inbox, Megaphone } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { fetchActiveNotices } from "../api/noticesApi"

function formatNoticeDate(value) {
  const date = String(value ?? "").slice(0, 10)
  return date ? date.replaceAll("-", ". ") : "게시일 확인 불가"
}

export function SiteNotice() {
  const [open, setOpen] = useState(false)
  const handledInitialResult = useRef(false)
  const noticesQuery = useQuery({
    queryKey: ["site-notices"],
    queryFn: ({ signal }) => fetchActiveNotices({ signal }),
    staleTime: 30 * 1000,
    retry: false,
  })
  const notices = noticesQuery.data?.notices ?? []

  useEffect(() => {
    if (!noticesQuery.isSuccess || handledInitialResult.current) return
    handledInitialResult.current = true
    if (notices.length > 0) setOpen(true)
  }, [notices.length, noticesQuery.isSuccess])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="fixed right-4 top-4 z-40 rounded-full border-primary/20 bg-background/95 text-primary shadow-lg backdrop-blur transition-transform hover:scale-105 hover:bg-primary/10 sm:right-6 sm:top-5"
          aria-label="공지사항 열기"
          title="공지사항"
        >
          <Bell className="size-5" aria-hidden="true" />
          {notices.length > 0 ? (
            <span className="absolute right-0.5 top-0.5 size-2.5 rounded-full border-2 border-background bg-destructive" />
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b bg-primary/5 px-6 pb-5 pt-6 sm:px-7">
          <DialogHeader className="pr-8">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Megaphone className="size-4.5" aria-hidden="true" />
              </span>
              <Badge variant="outline" className="border-primary/25 bg-background/80 text-primary">
                서비스 안내
              </Badge>
            </div>
            <DialogTitle className="text-xl leading-snug sm:text-2xl">L0 Spider 공지사항</DialogTitle>
            <DialogDescription>
              {notices.length > 0
                ? `현재 진행중인 공지 ${notices.length.toLocaleString()}건입니다.`
                : "현재 진행중인 공지가 없습니다."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-6 sm:px-7">
          {noticesQuery.isPending ? (
            <div className="grid min-h-32 place-items-center text-sm text-muted-foreground">
              공지사항을 불러오는 중입니다…
            </div>
          ) : noticesQuery.isError ? (
            <div className="grid min-h-32 place-items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center">
              <CircleAlert className="size-6 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">공지사항을 불러오지 못했습니다.</p>
                <p className="mt-1 text-xs text-muted-foreground">잠시 후 다시 시도해 주세요.</p>
              </div>
            </div>
          ) : notices.length === 0 ? (
            <div className="grid min-h-32 place-items-center gap-2 rounded-xl border border-dashed p-5 text-center">
              <Inbox className="size-7 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">진행중인 공지가 없습니다.</p>
            </div>
          ) : notices.map((notice) => (
            <article key={notice.noticeId} className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold leading-6 text-foreground">{notice.title}</h2>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {formatNoticeDate(notice.createdAt)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {notice.body}
              </p>
            </article>
          ))}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4 sm:px-7">
          <DialogClose asChild>
            <Button type="button">확인</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
