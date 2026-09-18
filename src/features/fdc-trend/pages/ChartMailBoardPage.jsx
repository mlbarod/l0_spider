import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ClipboardList, Loader2, RefreshCw, Search } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fetchChartMailPosts, fetchChartMailPost, updateChartMailPost, chartMailPostImageUrl } from "../api/chartMailBoardApi"
import { formatLineDisplayName } from "../utils/lineDisplay.mjs"

const appNames = { "self-equipment": "설비별 SPEC내 이상감지", "matching-anomaly": "동일성 이상감지", "common-anomaly": "공통부 이상감지" }
const workNames = { IN_PROGRESS: "진행중", COMPLETED: "완료" }
const mailNames = { pending: "처리중 / 결과 확인 필요", accepted: "메일전송 완료", rejected: "발송 거절", unknown: "결과 확인 필요" }
const formatDate = value => value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"

function WorkBadge({ status }) {
  return <Badge variant={status === "COMPLETED" ? "secondary" : "default"}>{workNames[status] ?? status}</Badge>
}

function PostDetail({ id, onClose }) {
  const client = useQueryClient()
  const [comment, setComment] = useState("")
  const [imageError, setImageError] = useState(false)
  const [imageAttempt, setImageAttempt] = useState(0)
  const query = useQuery({ queryKey: ["chart-mail-post", id], queryFn: ({ signal }) => fetchChartMailPost(id, signal), retry: false, staleTime: 0 })
  const post = query.data?.post
  const update = useMutation({
    mutationFn: input => updateChartMailPost(id, input),
    onSuccess: async () => {
      setComment("")
      await Promise.all([client.invalidateQueries({ queryKey: ["chart-mail-post", id] }), client.invalidateQueries({ queryKey: ["chart-mail-posts"] })])
      toast.success("업무 상태를 변경했습니다.")
    },
    onError: error => {
      toast.error(error.message)
      if (error.code === "BOARD_CONFLICT") void query.refetch()
    },
  })
  return <Dialog open onOpenChange={open => { if (!open && !update.isPending) onClose() }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle className="break-words pr-6">{post?.title ?? "차트 메일 발송 건"}</DialogTitle>
        <DialogDescription>발송 당시 내용과 차트 원본을 확인하고 업무 상태를 관리합니다.</DialogDescription>
      </DialogHeader>
      {query.isPending ? <p role="status" className="flex items-center gap-2 py-8"><Loader2 className="size-4 animate-spin" />게시글을 불러오는 중입니다.</p>
        : query.isError ? <div role="alert" className="grid gap-3"><p>{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>다시 조회</Button></div>
        : post ? <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-3 text-sm"><WorkBadge status={post.workStatus} /><span>{appNames[post.app] ?? "차트 메일"}</span><span className="text-muted-foreground">{formatDate(post.createdAt)}</span></div>
          <dl className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <div><dt className="inline font-medium">라인: </dt><dd className="inline">{formatLineDisplayName(post.line) || "미지정"}</dd><dt className="ml-4 inline font-medium">SDWT: </dt><dd className="inline">{post.sdwt || "미지정"}</dd></div>
            <div><dt className="inline font-medium">발신자: </dt><dd className="inline">{post.sender}</dd></div>
            <div className="break-words"><dt className="inline font-medium">수신인: </dt><dd className="inline">{post.recipients.join(", ")}</dd></div>
            <div><dt className="inline font-medium">메일 상태: </dt><dd className="inline">{mailNames[post.mailState] ?? post.mailState}</dd></div>
          </dl>
          {post.mailState === "pending" || post.mailState === "unknown" ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">발송 결과를 확인해 주세요. 중복 발송을 피하기 위해 자동 재발송하지 않습니다.</p> : null}
          <p className="whitespace-pre-wrap break-words text-sm">{post.details}</p>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-4 text-sm leading-6">{post.comment}</p>
          <section aria-label="발송 당시 차트 이미지" className="overflow-x-auto rounded-lg border bg-white p-3">
            {imageError ? <div role="alert" className="grid gap-3 text-sm"><p>보관된 이미지를 불러오지 못했습니다.</p><Button variant="outline" onClick={() => { setImageError(false); setImageAttempt(value => value + 1) }}>이미지 다시 조회</Button></div>
              : <img key={imageAttempt} src={chartMailPostImageUrl(post.id)} alt="메일 발송 당시 전체 범위 차트" className="h-auto max-w-full" onError={() => setImageError(true)} />}
          </section>
          {post.chartUrl && <Button asChild variant="outline" className="justify-self-start"><a href={post.chartUrl} target="_blank" rel="noreferrer">현재 차트 조회 화면</a></Button>}
          <section className="grid gap-3 rounded-lg border p-4" aria-label="업무 상태 변경">
            <h2 className="font-semibold">업무 상태 변경</h2>
            <label className="grid gap-2 text-sm">처리 코멘트 (선택)<Textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={1000} disabled={update.isPending} placeholder="조치 내용이나 진행 상황을 남겨 주세요." /></label>
            <Button className="justify-self-end" disabled={!post.canChangeStatus || update.isPending || query.isFetching} onClick={() => update.mutate({ status: post.workStatus === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED", version: post.version, comment })}>
              {update.isPending ? "저장 중…" : post.workStatus === "COMPLETED" ? "진행중으로 변경" : "완료 처리"}
            </Button>
          </section>
          <section aria-label="상태 변경 이력" className="grid gap-3">
            <h2 className="font-semibold">상태 변경 이력</h2>
            {post.history.length ? post.history.map((item, index) => <article key={`${item.changedAt}-${index}`} className="rounded-lg border p-3 text-sm">
              <p>{workNames[item.from]} → {workNames[item.to]} · {item.changedBy}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.changedAt)}</p>
              {item.comment && <p className="mt-2 whitespace-pre-wrap break-words">{item.comment}</p>}
            </article>) : <p className="text-sm text-muted-foreground">아직 상태 변경 이력이 없습니다.</p>}
          </section>
        </div> : null}
    </DialogContent>
  </Dialog>
}

export function ChartMailBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const id = searchParams.get("post")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [line, setLine] = useState("")
  const [sdwt, setSdwt] = useState("")
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ["chart-mail-posts", { page, status, search, line, sdwt }], queryFn: ({ signal }) => fetchChartMailPosts({ page, status, search, line, sdwt, signal }), retry: false, staleTime: 0 })
  const lines = [...new Set([line, ...(query.data?.filters?.lines ?? [])].filter(Boolean))]
  const sdwts = [...new Set([sdwt, ...(query.data?.filters?.sdwts ?? [])].filter(Boolean))]
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20))
  useEffect(() => {
    if (query.isSuccess && page > pages) setPage(pages)
  }, [query.isSuccess, page, pages])
  return <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-muted/30">
    <header className="border-b bg-card py-5 pl-6 pr-20"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-xl font-semibold"><ClipboardList className="size-5 text-primary" />Chart Mailing 게시판</h1><p className="mt-2 text-sm text-muted-foreground">차트 메일 발송 건과 당시 이미지를 확인하고 진행 상황을 관리합니다.</p></div>
      <Button asChild variant="outline"><Link to="/"><ArrowLeft className="size-4" />SPIDER 메인</Link></Button>
    </div></header>
    <main className="mx-auto grid w-full max-w-[1440px] gap-5 p-6">
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1) }}>
        <label className="grid gap-2 text-sm">라인<select aria-label="라인" value={line} disabled={query.isPending} onChange={event => { setLine(event.target.value); setSdwt(""); setPage(1) }} className="h-10 min-w-32 rounded-md border bg-background px-3"><option value="">전체</option>{lines.map(value => <option key={value} value={value}>{formatLineDisplayName(value)}</option>)}</select></label>
        <label className="grid gap-2 text-sm">SDWT<select aria-label="SDWT" value={sdwt} disabled={query.isPending} onChange={event => { setSdwt(event.target.value); setPage(1) }} className="h-10 min-w-32 rounded-md border bg-background px-3"><option value="">전체</option>{sdwts.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="grid gap-2 text-sm">업무 상태<select aria-label="업무 상태" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }} className="h-10 rounded-md border bg-background px-3"><option value="">전체</option><option value="IN_PROGRESS">진행중</option><option value="COMPLETED">완료</option></select></label>
        <label className="grid min-w-48 flex-1 gap-2 text-sm">검색<Input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={200} placeholder="제목, 발신자, 차트 정보" className="h-10" /></label>
        <Button type="submit" className="h-10"><Search className="size-4" />검색</Button>
        <Button type="button" variant="outline" className="h-10" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className="size-4" />새로고침</Button>
      </form>
      {query.isPending ? <p role="status" className="py-10 text-center">게시글을 불러오는 중입니다.</p>
        : query.isError ? <div role="alert" className="rounded-xl border bg-card p-6">{query.error.message}</div>
        : <>
          <p className="text-sm text-muted-foreground">총 {query.data.total.toLocaleString()}건 · 로그인 사용자는 누구나 조회하고 상태를 변경할 수 있습니다.</p>
          <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b bg-muted/40"><tr><th className="p-4">업무 상태</th><th className="p-4">라인 / SDWT</th><th className="p-4">제목 / App</th><th className="p-4">발신자</th><th className="p-4">메일 상태</th><th className="p-4">등록 시각</th></tr></thead>
            <tbody>{query.data.posts.length ? query.data.posts.map(post => <tr key={post.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="p-4"><WorkBadge status={post.workStatus} /></td>
              <td className="p-4"><p>{formatLineDisplayName(post.line) || "미지정"}</p><p className="mt-1 text-xs text-muted-foreground">{post.sdwt || "미지정"}</p></td>
              <td className="max-w-lg p-4"><Link to={`?post=${post.id}`} className="break-words font-medium text-primary underline-offset-4 hover:underline">{post.title}</Link><p className="mt-1 text-xs text-muted-foreground">{appNames[post.app] ?? "차트 메일"}</p></td>
              <td className="p-4">{post.sender}</td><td className="p-4">{mailNames[post.mailState] ?? post.mailState}</td><td className="whitespace-nowrap p-4 text-xs">{formatDate(post.createdAt)}</td>
            </tr>) : <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">조건에 맞는 발송 건이 없습니다.</td></tr>}</tbody>
          </table></div>
          <nav aria-label="게시판 페이지" className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>이전</Button><span className="text-sm">{page} / {pages}</span><Button variant="outline" disabled={page >= pages || query.isFetching} onClick={() => setPage(value => value + 1)}>다음</Button></nav>
        </>}
    </main>
    {id && <PostDetail key={id} id={id} onClose={() => setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete("post"); return next })} />}
  </div>
}
