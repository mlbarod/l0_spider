import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const emptyRule = { field: "user_id", matchType: "exact", matchValue: "" }
const selectClass = "mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"

export function AccessManagement({ userId, onRoleChange }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [masterId, setMasterId] = useState("")
  const [rule, setRule] = useState(emptyRule)
  const [search, setSearch] = useState("")

  async function request(method = "GET", payload) {
    const response = await fetch("/api/access-control", {
      method, cache: "no-store",
      ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}),
    })
    const result = await response.json()
    if (!response.ok) {
      if (response.status === 401 || result.code === "ACCESS_DENIED") window.location.assign("/")
      if (result.code === "MASTER_REQUIRED") { setOpen(false); onRoleChange() }
      throw new Error(result.error || "권한 정보를 불러오지 못했습니다.")
    }
    return result
  }

  async function load() {
    setBusy(true); setError(""); setNotice("")
    try { setData(await request()) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function mutate(method, payload) {
    setBusy(true); setError(""); setNotice("")
    try {
      await request(method, payload)
      if (payload.target === "master" && method === "DELETE" && payload.userId === userId?.toLowerCase()) {
        setOpen(false); onRoleChange(); return
      }
      // Clear only the form that was submitted, before fetching the saved list.
      if (payload.target === "master" && method === "POST") setMasterId("")
      if (payload.target === "rule" && method !== "DELETE") setRule(emptyRule)
      if (payload.target === "rule" && payload.ruleId === rule.ruleId) setRule(emptyRule)
      setData(await request())
      setNotice("권한 설정을 저장했습니다.")
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      setOpen(next)
      if (next) { setData(null); setRule(emptyRule); setMasterId(""); setSearch(""); void load() }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><ShieldCheck className="size-4" aria-hidden="true" />권한 관리</Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>권한 관리</DialogTitle>
          <DialogDescription>유저ID와 소속부서 조건으로 웹서비스 접근 권한을 관리합니다. 마스터와 일반 유저는 권한 관리 외에 동일한 기능을 사용합니다.</DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">마스터 계정이거나 접근 권한 규칙 중 하나에 일치해야 이용할 수 있습니다. 권한 변경은 다음 요청부터 적용됩니다.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p role="status" className="text-sm text-muted-foreground">{busy ? "처리 중…" : notice}</p>
        {!data && !busy && <Button variant="outline" onClick={load}>다시 불러오기</Button>}
        {data && <>
          <section className="space-y-3 rounded-lg border p-4" aria-labelledby="master-accounts-title">
            <div><h2 id="master-accounts-title" className="font-semibold">마스터 계정 <span className="text-muted-foreground">{data.masters.length}명</span></h2><p className="mt-1 text-sm text-muted-foreground">유저ID가 직접 일치하는 계정입니다. 마지막 마스터 1명은 회수할 수 없습니다.</p></div>
            <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void mutate("POST", { target: "master", userId: masterId }) }}>
              <label className="flex-1 text-sm">마스터 유저ID<Input className="mt-1" required maxLength={100} value={masterId} onChange={event => setMasterId(event.target.value)} placeholder="유저ID 입력" disabled={busy} /></label>
              <Button type="submit" disabled={busy || !masterId.trim()}>마스터 추가</Button>
            </form>
            <ul className="divide-y">
              {data.masters.map(master => <li key={master.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 break-all font-medium">{master.userId}{master.userId === userId?.toLowerCase() && <span className="ml-2 text-xs text-muted-foreground">현재 사용자</span>}</span>
                <Button variant="outline" size="sm" disabled={busy || data.masters.length <= 1} onClick={() => {
                  if (window.confirm(`${master.userId}의 마스터 권한을 회수하시겠습니까? 일반 접근 규칙에도 해당하지 않으면 웹서비스 접근이 차단됩니다.`)) void mutate("DELETE", { target: "master", userId: master.userId })
                }}>권한 회수</Button>
              </li>)}
            </ul>
          </section>
          <section className="space-y-4 rounded-lg border p-4" aria-labelledby="access-rules-title">
            <div><h2 id="access-rules-title" className="font-semibold">일반 유저 접근 권한 규칙 <span className="text-muted-foreground">{data.rules.length}개</span></h2><p className="mt-1 text-sm text-muted-foreground">유저ID는 직접 일치, 소속부서는 직접 일치 또는 텍스트 포함으로 설정합니다.</p></div>
            <form className="space-y-3 rounded-md bg-muted/40 p-3" onSubmit={event => { event.preventDefault(); void mutate(rule.ruleId ? "PATCH" : "POST", { ...rule, target: "rule" }) }}>
              <h3 className="text-sm font-medium">{rule.ruleId ? "규칙 수정" : "규칙 추가"}</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
                <label className="text-sm">기준 항목<select className={selectClass} value={rule.field} disabled={busy} onChange={event => setRule({ ...rule, field: event.target.value, matchType: "exact", matchValue: "" })}><option value="user_id">유저ID</option><option value="department">소속부서</option></select></label>
                <label className="text-sm">적용 방식<select className={selectClass} value={rule.matchType} disabled={busy || rule.field === "user_id"} onChange={event => setRule({ ...rule, matchType: event.target.value })}><option value="exact">직접 일치</option>{rule.field === "department" && <option value="contains">텍스트 포함</option>}</select></label>
                <label className="text-sm">조건 값<Input className="mt-1" required maxLength={rule.field === "user_id" ? 100 : 200} value={rule.matchValue} disabled={busy} onChange={event => setRule({ ...rule, matchValue: event.target.value })} placeholder={rule.field === "user_id" ? "유저ID 입력" : "부서명 또는 포함할 텍스트"} /></label>
              </div>
              <div className="flex justify-end gap-2">{rule.ruleId && <Button variant="outline" type="button" disabled={busy} onClick={() => setRule(emptyRule)}>수정 취소</Button>}<Button type="submit" disabled={busy || !rule.matchValue.trim()}>{rule.ruleId ? "변경 저장" : "규칙 추가"}</Button></div>
            </form>
            <Input type="search" aria-label="권한 규칙 검색" placeholder="조건 값 검색" value={search} onChange={event => setSearch(event.target.value)} />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">일반 유저 접근 권한 규칙 목록</caption>
                <thead className="border-b text-muted-foreground"><tr>{["기준 항목", "적용 방식", "조건 값", "관리"].map(label => <th key={label} scope="col" className="whitespace-nowrap p-2 font-medium">{label}</th>)}</tr></thead>
                <tbody>{data.rules.filter(item => item.matchValue.toLowerCase().includes(search.toLowerCase())).map(item => <tr key={item.ruleId} className="border-b">
                  <td className="whitespace-nowrap p-2">{item.field === "user_id" ? "유저ID" : "소속부서"}</td><td className="whitespace-nowrap p-2">{item.matchType === "exact" ? "직접 일치" : "텍스트 포함"}</td><td className="min-w-32 break-all p-2">{item.matchValue}</td>
                  <td className="p-2"><div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy} aria-label={`${item.matchValue} 규칙 수정`} onClick={() => setRule(item)}>수정</Button><Button variant="outline" size="sm" disabled={busy} aria-label={`${item.matchValue} 규칙 삭제`} onClick={() => {
                    if (window.confirm(`'${item.matchValue}' 규칙을 삭제하시겠습니까? 다른 규칙에 해당하지 않는 사용자는 접근이 차단됩니다.`)) void mutate("DELETE", { target: "rule", ruleId: item.ruleId })
                  }}>삭제</Button></div></td>
                </tr>)}</tbody>
              </table>
            </div>
            {!data.rules.length && <p className="text-sm text-muted-foreground">등록된 규칙이 없습니다. 현재 마스터만 웹서비스에 접근할 수 있습니다.</p>}
            {!!data.rules.length && !data.rules.some(item => item.matchValue.toLowerCase().includes(search.toLowerCase())) && <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
          </section>
        </>}
      </DialogContent>
    </Dialog>
  )
}
