import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fetchCurrentUser } from "../api/currentUserApi"
import { fetchChartMailStatus, fetchMailRecipientGroups, sendChartMail } from "../api/chartMailApi"
import { CHART_MAIL_COMMENTS, MAX_CHART_MAIL_COMMENT_LENGTH, parseMailRecipients } from "../utils/chartMail.mjs"

export function ChartMailDialog({ title, details, prepareImage, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState("")
  const [direct, setDirect] = useState("")
  const [selectedGroups, setSelectedGroups] = useState([])
  const [commentChoice, setCommentChoice] = useState(CHART_MAIL_COMMENTS[0])
  const [customComment, setCustomComment] = useState("")
  const comment = commentChoice === "custom" ? customComment : commentChoice
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [sendError, setSendError] = useState("")
  const [uncertain, setUncertain] = useState(false)
  const sendLock = useRef(false)
  const generation = useRef(0)
  const requestId = useRef(null)
  const prepareRef = useRef(null)
  const currentUser = useQuery({ queryKey: ["current-user"], queryFn: fetchCurrentUser, enabled: open, retry: false, staleTime: 300000 })
  const knoxId = currentUser.data?.knoxId
  const groups = useQuery({ queryKey: ["mail-recipient-groups", knoxId], queryFn: fetchMailRecipientGroups, enabled: open && Boolean(knoxId), retry: false })
  const status = useQuery({ queryKey: ["chart-mail-status"], queryFn: fetchChartMailStatus, enabled: open && Boolean(knoxId), retry: false, staleTime: 0 })
  let recipients = []
  let recipientError = ""
  try {
    const selected = (groups.data?.groups ?? []).filter((group) => selectedGroups.includes(group.id)).flatMap((group) => group.recipients)
    recipients = parseMailRecipients([...selected, ...direct.split(/[\s,;]+/).filter(Boolean)])
  } catch (error) { recipientError = error.message }
  const locked = sending || Boolean(result) || uncertain
  const contentValid = Boolean(draft?.title.trim()) && Boolean(comment.trim())
  async function prepare() {
    const token = ++generation.current
    setImageBusy(true)
    setImageError("")
    try {
      const image = await prepareRef.current()
      if (token === generation.current) setDraft((previous) => ({ ...previous, image }))
    } catch (error) {
      if (token === generation.current) setImageError(error.message)
    } finally {
      if (token === generation.current) setImageBusy(false)
    }
  }
  function openDraft() {
    prepareRef.current = prepareImage
    setDraft({ title, details, image: null })
    setDirect("")
    setSelectedGroups([])
    setCommentChoice(CHART_MAIL_COMMENTS[0])
    setCustomComment("")
    setResult(null)
    setSendError("")
    setUncertain(false)
    requestId.current = crypto.randomUUID()
    setOpen(true)
    prepare()
  }
  async function send() {
    if (sendLock.current || locked || !contentValid || !draft?.image || recipientError || !status.data?.ready) return
    sendLock.current = true
    setSending(true)
    setSendError("")
    try {
      const response = await sendChartMail({ requestId: requestId.current, title: draft.title, details: draft.details, comment, recipients, image: draft.image })
      if (response.status !== "accepted") {
        setUncertain(true)
        setSendError("메일전송 실패. 관리자에게 문의바랍니다")
      } else setResult(response)
    } catch (error) {
      setSendError("메일전송 실패. 관리자에게 문의바랍니다")
      if (["NETWORK_ERROR", "UNKNOWN_RESPONSE", "MAIL_RESULT_UNKNOWN", "MAIL_IN_PROGRESS", "MAIL_REJECTED", "MAIL_REQUEST_CONFLICT"].includes(error.code)) setUncertain(true)
    } finally {
      setSending(false)
      sendLock.current = false
    }
  }
  return <>
    <Button type="button" variant="outline" size="sm" className="h-9 px-[0.9rem] text-sm" disabled={disabled} onClick={openDraft}><Mail className="size-4" />메일보내기</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!sending) { setOpen(value); if (!value) generation.current += 1 } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>이상감지 차트 메일</DialogTitle><DialogDescription>전체 범위 차트와 수신인을 확인한 뒤 보내기를 눌러 주세요.</DialogDescription></DialogHeader>
        <p className="text-sm">발신자: {knoxId || "로그인 사용자 확인 중…"}</p>
        {currentUser.isError && <p role="alert" className="text-sm text-destructive">{currentUser.error.message}</p>}
        <fieldset disabled={locked} className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">수신인</legend>
          {groups.data?.groups?.length > 0 && <div className="flex flex-wrap gap-3">{groups.data.groups.map((group) => <label key={group.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedGroups.includes(group.id)} onChange={(event) => setSelectedGroups((previous) => event.target.checked ? [...previous, group.id] : previous.filter((id) => id !== group.id))} />{group.name} ({group.recipients.length}명)</label>)}</div>}
          {groups.isError && <p role="alert" className="text-sm text-destructive">{groups.error.message} Knox ID를 직접 입력할 수 있습니다.</p>}
          <label className="grid gap-1 text-sm">Knox ID 직접 입력<Input value={direct} onChange={(event) => setDirect(event.target.value)} maxLength={15000} placeholder="쉼표 또는 공백으로 구분" /></label>
          <p className="break-words text-xs text-muted-foreground">{recipients.length ? `최종 수신인 ${recipients.length}명: ${recipients.join(", ")}` : recipientError}</p>
          <label className="grid gap-1 text-sm">메일 제목<Input value={draft?.title ?? ""} onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))} maxLength={300} /></label>
          <label className="grid gap-1 text-sm">코멘트<select className="h-10 rounded-md border bg-background px-3" value={commentChoice} onChange={(event) => setCommentChoice(event.target.value)}>{CHART_MAIL_COMMENTS.map((text) => <option key={text}>{text}</option>)}<option value="custom">직접 입력</option></select></label>
          {commentChoice === "custom" && <label className="grid gap-1 text-sm">코멘트 직접 입력<textarea className="min-h-28 rounded-md border bg-background px-3 py-2" value={customComment} onChange={(event) => setCustomComment(event.target.value)} maxLength={MAX_CHART_MAIL_COMMENT_LENGTH} rows={4} placeholder="메일에 포함할 코멘트를 입력해 주세요." /><span className="text-xs text-muted-foreground">{customComment.length} / {MAX_CHART_MAIL_COMMENT_LENGTH}자</span></label>}
        </fieldset>
        <section aria-label="메일 본문" className="grid gap-3 rounded-lg border bg-white p-5 text-slate-900">
          <h3 className="font-semibold">{draft?.title}</h3>
          <p className="whitespace-pre-wrap break-words text-sm">{draft?.details}</p>
          <p className="whitespace-pre-wrap break-words py-[60px] text-sm leading-5">{comment}</p>
          <p className="text-xs text-slate-500">차트 전체 범위</p>
          {imageBusy ? <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />전체 범위 이미지를 준비 중입니다.</p> : imageError ? <div role="alert" className="text-sm text-destructive">{imageError} <Button variant="outline" size="sm" onClick={prepare}>다시 준비</Button></div> : draft?.image ? <img src={draft.image} alt="메일 본문에 포함할 전체 범위 차트" className="h-auto w-full" /> : null}
        </section>
        {status.isError && <p role="alert" className="text-sm text-destructive">{status.error.message}</p>}
        {status.data && !status.data.ready && <p role="status" className="text-sm text-amber-700">{status.data.reason}{status.data.requestId && ` [문의 코드: ${status.data.requestId}]`}</p>}
        {sendError && <p role="alert" className="text-sm text-destructive">{sendError}</p>}
        {result && <p role="status" className="text-sm text-green-700">메일전송 완료</p>}
        <DialogFooter><Button variant="outline" disabled={sending} onClick={() => { generation.current += 1; setOpen(false) }}>닫기</Button><Button disabled={locked || !contentValid || imageBusy || !draft?.image || !knoxId || Boolean(recipientError) || !status.data?.ready} onClick={send}>{sending ? "발송 중…" : result ? "메일전송 완료" : "보내기"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
