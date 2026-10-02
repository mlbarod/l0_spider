import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { saveChartHistory } from "../api/chartMailBoardApi"
import { ChartMailDialog } from "./ChartMailDialog"

export function ChartMailActions({ allowMail = true, ...props }) {
  const client = useQueryClient()
  const lock = useRef(false)
  const pendingDraft = useRef(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (lock.current || props.disabled) return
    lock.current = true
    setSaving(true)
    try {
      // Keep the exact request after a lost response so retry cannot duplicate it.
      if (!pendingDraft.current || pendingDraft.current.chartPath !== props.chartPath) {
        const image = await props.prepareImage()
        pendingDraft.current = {
          chartPath: props.chartPath,
          input: {
            requestId: crypto.randomUUID(), title: props.title, details: props.details,
            chartUrl: new URL(props.chartPath, window.location.origin).href, image,
          },
        }
      }
      await saveChartHistory(pendingDraft.current.input)
      pendingDraft.current = null
      setSaved(true)
      void client.invalidateQueries({ queryKey: ["chart-mail-posts"] })
    } catch (error) {
      toast.error(error.message || "게시판 등록에 실패했습니다. 다시 시도해 주세요.")
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return <>
    {allowMail && <ChartMailDialog {...props} />}
    <Button type="button" variant="outline" size="sm" className="h-9 px-[0.9rem] text-sm" disabled={props.disabled || saving} onClick={save}>
      {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
      이력저장
    </Button>
    <Dialog open={saved} onOpenChange={setSaved}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이력저장 완료</DialogTitle>
          <DialogDescription>메일보내기 이력 및 이력저장 게시판 등록 완료</DialogDescription>
        </DialogHeader>
        <DialogFooter><Button onClick={() => setSaved(false)}>확인</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
