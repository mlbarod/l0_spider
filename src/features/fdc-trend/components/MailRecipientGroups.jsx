import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deleteMailRecipientGroup, fetchMailRecipientGroups, saveMailRecipientGroup } from "../api/chartMailApi"
import { parseMailRecipients } from "../utils/chartMail.mjs"

export function MailRecipientGroups({ knoxId }) {
  const client = useQueryClient()
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState("")
  const [recipients, setRecipients] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryKey = ["mail-recipient-groups", knoxId]
  const groups = useQuery({ queryKey, queryFn: fetchMailRecipientGroups, enabled: Boolean(knoxId), retry: false })
  const reset = () => { setEditingId(null); setName(""); setRecipients("") }
  const save = useMutation({
    mutationFn: saveMailRecipientGroup,
    onSuccess: () => { reset(); client.invalidateQueries({ queryKey }); toast.success("수신인 그룹을 저장했습니다.") },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: deleteMailRecipientGroup,
    onSuccess: () => {
      if (deleteTarget.id === editingId) reset()
      setDeleteTarget(null)
      client.invalidateQueries({ queryKey })
      toast.success("수신인 그룹을 삭제했습니다.")
    },
    onError: (error) => toast.error(error.message),
  })
  const busy = save.isPending || remove.isPending
  function submit(event) {
    event.preventDefault()
    try {
      const ids = parseMailRecipients(recipients)
      save.mutate({ ...(editingId ? { id: editingId } : {}), name: name.trim(), recipients: ids })
    } catch (error) { toast.error(error.message) }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>내 수신인 그룹</CardTitle>
        <CardDescription>Chart Mailing 저장 버튼으로 그룹을 저장하면 차트 메일 작성창에서 선택할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!knoxId ? <p className="text-sm text-muted-foreground">로그인 사용자 확인 후 그룹을 관리할 수 있습니다.</p> : <>
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-4">
            <label className="grid gap-1 text-sm">그룹 소유자 (knox_id)
              <Input value={knoxId} readOnly className="bg-background" />
            </label>
            <p className="text-xs text-muted-foreground">이 계정으로 만든 그룹만 조회·수정·삭제할 수 있습니다.</p>
          </div>
          <form onSubmit={submit} className="grid gap-3 rounded-lg border p-4">
            <label className="grid gap-1 text-sm">그룹 이름
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={busy} placeholder="예: 설비 담당자" />
            </label>
            <label className="grid gap-1 text-sm">수신인 Knox ID
              <textarea value={recipients} onChange={(event) => setRecipients(event.target.value)} required disabled={busy} maxLength={15000} rows={3} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="쉼표 또는 줄바꿈으로 구분해 주세요." />
            </label>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {editingId && <Button type="button" variant="outline" disabled={busy} onClick={reset}>수정 취소</Button>}
              <Button type="submit" size="lg" className="h-12 min-w-52 rounded-xl text-base shadow-lg shadow-primary/15" disabled={busy || !name.trim() || !recipients.trim()}>
                {save.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
                {save.isPending ? "저장 중…" : editingId ? "Chart Mailing 수정 저장" : "Chart Mailing 저장"}
              </Button>
            </div>
          </form>
          {groups.isPending ? <p className="text-sm">그룹을 불러오는 중입니다.</p> : groups.isError ? (
            <div role="alert" className="text-sm text-destructive">{groups.error.message} <Button variant="outline" size="sm" onClick={() => groups.refetch()}>다시 불러오기</Button></div>
          ) : groups.data?.groups?.length ? (
            <ul className="grid gap-2">
              {groups.data.groups.map((group) => <li key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{group.name} <span className="text-xs text-muted-foreground">{group.recipients.length}명</span></p><p className="break-words text-xs text-muted-foreground">{group.recipients.join(", ")}</p></div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => { setEditingId(group.id); setName(group.name); setRecipients(group.recipients.join(", ")) }}>수정</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeleteTarget(group)}>삭제</Button>
                </div>
              </li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">저장된 개인 수신인 그룹이 없습니다.</p>}
        </>}
      </CardContent>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !busy) setDeleteTarget(null) }}>
        <DialogContent><DialogHeader><DialogTitle>수신인 그룹 삭제</DialogTitle><DialogDescription>‘{deleteTarget?.name}’ 그룹을 삭제할까요?</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>취소</Button><Button variant="destructive" disabled={busy} onClick={() => remove.mutate(deleteTarget.id)}>삭제</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
