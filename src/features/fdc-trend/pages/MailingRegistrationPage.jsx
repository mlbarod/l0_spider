import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  MailPlus,
  Search,
  Send,
  UserRound,
} from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { fetchCurrentUser } from "../api/currentUserApi"
import {
  createMailingRegistration,
  fetchMailingRegistrations,
} from "../api/mailingRegistrationApi"
import { fetchLineMapping } from "../api/mappingConfigApi"
import { ResizableFilterArea } from "../components/ResizableFilterArea"
import { formatLineDisplayName } from "../utils/lineDisplay.mjs"
import { expandMailingRegistrationRows } from "../utils/mailingRegistration.mjs"

const EMPTY_LIST = Object.freeze([])
const EMPTY_MAPPING = Object.freeze({})
const ALL_SDWT = "__ALL_SDWT__"
const MAILING_PRIORITIES = Object.freeze(["A", "B", "D", "M", "N"])
const KNOX_ID_PATTERN = /^[A-Za-z0-9._-]+$/

function matchesQuery(value, query) {
  return String(value).toLocaleLowerCase("ko").includes(query.trim().toLocaleLowerCase("ko"))
}

function normalizeKnoxId(value) {
  const text = String(value ?? "").trim()
  return text.includes("@") ? text.slice(0, text.indexOf("@")) : text
}

function FilterPanel({
  step,
  title,
  description,
  options,
  selectedValue,
  selectedValues = EMPTY_LIST,
  multiple = false,
  onSelect,
  query,
  onQueryChange,
  disabled = false,
  isLoading = false,
  emptyMessage,
}) {
  const hasSelection = multiple ? selectedValues.length > 0 : Boolean(selectedValue)

  return (
    <Card className={cn(
      "h-full min-h-[280px] gap-0 overflow-hidden py-0 transition-shadow",
      hasSelection && "border-primary/35 shadow-md shadow-primary/5",
    )}>
      <CardHeader className={cn(
        "gap-1 border-b px-4 py-4",
        hasSelection ? "bg-primary/5" : "bg-muted/30",
      )}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
              hasSelection ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              {step}
            </span>
            <CardTitle className="truncate text-sm">{title}</CardTitle>
          </div>
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="로딩 중" />
          ) : (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {multiple && selectedValues.length ? `${selectedValues.length} 선택` : options.length}
            </Badge>
          )}
        </div>
        <CardDescription className="pl-8 text-xs leading-5">{description}</CardDescription>
      </CardHeader>
      <div className="border-b px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={`${title} 검색`}
            className="h-8 pl-8 text-xs"
            disabled={disabled}
            aria-label={`${title} 검색`}
          />
        </div>
      </div>
      <CardContent className="min-h-0 flex-1 overflow-y-auto bg-background/60 p-2.5">
        {disabled || options.length === 0 ? (
          <div className="grid min-h-32 place-items-center px-5 text-center text-xs leading-5 text-muted-foreground">
            {isLoading ? "기준정보를 불러오는 중입니다." : emptyMessage}
          </div>
        ) : (
          <div className="grid gap-1.5">
            {options.map((option) => {
              const selected = multiple
                ? selectedValues.includes(option.value)
                : selectedValue === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(option.value)}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left text-xs transition",
                    "hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium" title={option.label}>
                    {option.label}
                  </span>
                  {option.meta ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{option.meta}</span>
                  ) : null}
                  {multiple ? (
                    <span className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                    )}>
                      <Check className={cn("size-3", !selected && "text-transparent")} aria-hidden="true" />
                    </span>
                  ) : selected ? (
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SelectionItem({ label, value, complete }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <span className={cn(
          "size-1.5 shrink-0 rounded-full",
          complete ? "bg-primary" : "bg-muted-foreground/40",
        )} />
        <p className={cn(
          "truncate text-sm font-semibold",
          complete ? "text-foreground" : "text-muted-foreground",
        )} title={value}>
          {value || "미선택"}
        </p>
      </div>
    </div>
  )
}

export function MailingRegistrationPage() {
  const queryClient = useQueryClient()
  const initializedKnoxId = useRef(false)
  const [selectedLine, setSelectedLine] = useState("")
  const [selectedSdwts, setSelectedSdwts] = useState([])
  const [knoxId, setKnoxId] = useState("")
  const [lookupKnoxId, setLookupKnoxId] = useState("")
  const [lineQuery, setLineQuery] = useState("")
  const [sdwtQuery, setSdwtQuery] = useState("")
  const [urlTarget, setUrlTarget] = useState(null)
  const [saveFailure, setSaveFailure] = useState(null)

  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const mappingQuery = useQuery({
    queryKey: ["l0-spider-line-mapping"],
    queryFn: fetchLineMapping,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const currentKnoxId = normalizeKnoxId(currentUserQuery.data?.knoxId)
    if (!currentKnoxId || initializedKnoxId.current) return
    initializedKnoxId.current = true
    setKnoxId(currentKnoxId)
    setLookupKnoxId(currentKnoxId)
  }, [currentUserQuery.data?.knoxId])

  useEffect(() => {
    const normalized = normalizeKnoxId(knoxId)
    const timeout = setTimeout(() => setLookupKnoxId(normalized), 350)
    return () => clearTimeout(timeout)
  }, [knoxId])

  const lineMapping = mappingQuery.data?.line_mapping ?? EMPTY_MAPPING
  const sdwtMapping = mappingQuery.data?.sdwt_mapping ?? EMPTY_MAPPING
  const lines = useMemo(() => Array.from(new Set(Object.values(lineMapping)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "ko", { numeric: true })), [lineMapping])
  const lineOptions = lines
    .map((line) => ({ value: line, label: formatLineDisplayName(line) }))
    .filter((option) => matchesQuery(option.label, lineQuery))
  const sdwtOptions = useMemo(() => {
    const labels = Object.entries(lineMapping)
      .filter(([, line]) => line === selectedLine)
      .map(([key]) => String(sdwtMapping[key] ?? key).trim())
      .filter(Boolean)
    return Array.from(new Set(labels))
      .sort((left, right) => left.localeCompare(right, "ko", { numeric: true }))
      .map((value) => ({ value, label: value }))
  }, [lineMapping, sdwtMapping, selectedLine])
  const visibleSdwtOptions = (sdwtOptions.length ? [
    { value: ALL_SDWT, label: "ALL", meta: `${sdwtOptions.length.toLocaleString()}개` },
    ...sdwtOptions,
  ] : []).filter((option) => matchesQuery(option.label, sdwtQuery))
  const validSdwtValues = useMemo(() => new Set(sdwtOptions.map((option) => option.value)), [sdwtOptions])
  const activeSdwts = selectedSdwts.includes(ALL_SDWT) && sdwtOptions.length
    ? [ALL_SDWT]
    : selectedSdwts.filter((sdwt) => validSdwtValues.has(sdwt))
  const resolvedSdwts = activeSdwts.includes(ALL_SDWT)
    ? sdwtOptions.map((option) => option.value)
    : activeSdwts
  const selectedSdwtLabel = activeSdwts.includes(ALL_SDWT)
    ? `ALL (${sdwtOptions.length.toLocaleString()}개)`
    : activeSdwts.join(", ")
  const normalizedInputKnoxId = normalizeKnoxId(knoxId)
  const validInputKnoxId = Boolean(
    normalizedInputKnoxId
      && normalizedInputKnoxId.length <= 128
      && KNOX_ID_PATTERN.test(normalizedInputKnoxId),
  )
  const validLookupKnoxId = lookupKnoxId.length <= 128 && KNOX_ID_PATTERN.test(lookupKnoxId)
    ? lookupKnoxId
    : ""

  const registrationsQuery = useQuery({
    queryKey: ["mailing-registrations", validLookupKnoxId],
    queryFn: () => fetchMailingRegistrations({ knoxId: validLookupKnoxId }),
    enabled: Boolean(validLookupKnoxId),
    staleTime: 15 * 1000,
    retry: false,
  })
  const registrationRows = useMemo(() => expandMailingRegistrationRows(
    registrationsQuery.data,
    lineMapping,
    sdwtMapping,
  ), [lineMapping, registrationsQuery.data, sdwtMapping])

  const registrationMutation = useMutation({
    mutationFn: createMailingRegistration,
    onSuccess: (result) => {
      const savedKnoxId = result.registration?.knoxId ?? normalizedInputKnoxId
      setSaveFailure(null)
      setLookupKnoxId(savedKnoxId)
      queryClient.invalidateQueries({ queryKey: ["mailing-registrations", savedKnoxId] })
      toast.success("Mailing 기능을 등록했습니다.", {
        description: `${result.registration?.sdwts?.length ?? resolvedSdwts.length}개 SDWT · 5개 Grade`,
      })
    },
    onError: (error) => {
      toast.error(error.message)
      if (error.debugRow) setSaveFailure({ message: error.message, row: error.debugRow })
    },
  })

  const isReadyToSave = Boolean(
    selectedLine && resolvedSdwts.length && validInputKnoxId && !mappingQuery.isLoading,
  )

  const handleLineChange = (line) => {
    setSelectedLine(line)
    setSelectedSdwts([])
    setSdwtQuery("")
  }

  const toggleSdwt = (sdwt) => {
    if (sdwt === ALL_SDWT) {
      setSelectedSdwts((current) => current.includes(ALL_SDWT) ? [] : [ALL_SDWT])
      return
    }
    setSelectedSdwts((current) => (
      current.includes(sdwt)
        ? current.filter((item) => item !== sdwt)
        : [...current.filter((item) => item !== ALL_SDWT), sdwt]
    ))
  }

  const handleSave = () => {
    if (!isReadyToSave || registrationMutation.isPending) return
    registrationMutation.mutate({ knoxId: normalizedInputKnoxId, sdwts: resolvedSdwts })
  }

  const showUrl = (row) => {
    const absoluteUrl = typeof window === "undefined"
      ? row.url
      : new URL(row.url, window.location.origin).toString()
    setUrlTarget({ ...row, absoluteUrl })
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-muted/30">
      <header className="shrink-0 border-b bg-card px-5 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <MailPlus className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">이상감지 수신인 등록</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Line과 SDWT 조건별 이상감지 Mailing 대상자를 등록합니다.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              SPIDER 메인
            </Link>
          </Button>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1680px] gap-5">
          <section aria-labelledby="mailing-filter-title">
            <div className="mb-3">
              <h2 id="mailing-filter-title" className="text-base font-semibold">Mailing 조건 선택</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Line을 선택한 뒤 SDWT를 복수 선택하거나 ALL로 한 번에 선택할 수 있습니다.
              </p>
            </div>

            <ResizableFilterArea defaultHeight={310} minHeight={220} maxHeight={700}>
              <div className="grid h-full gap-4 overflow-y-auto pb-1 md:grid-cols-2">
                <FilterPanel
                  step="1"
                  title="Line Name"
                  description="Mailing을 등록할 Line을 선택하세요."
                  options={lineOptions}
                  selectedValue={selectedLine}
                  onSelect={handleLineChange}
                  query={lineQuery}
                  onQueryChange={setLineQuery}
                  disabled={mappingQuery.isLoading || lines.length === 0}
                  isLoading={mappingQuery.isFetching}
                  emptyMessage="선택 가능한 Line이 없습니다."
                />
                <FilterPanel
                  step="2"
                  title="SDWT"
                  description="복수 선택할 수 있으며, ALL은 해당 Line 전체를 의미합니다."
                  options={visibleSdwtOptions}
                  selectedValues={activeSdwts}
                  multiple
                  onSelect={toggleSdwt}
                  query={sdwtQuery}
                  onQueryChange={setSdwtQuery}
                  disabled={!selectedLine}
                  emptyMessage="Line Name을 먼저 선택하세요."
                />
              </div>
            </ResizableFilterArea>

            {mappingQuery.isError ? (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                기준정보 매핑 오류: {mappingQuery.error.message}
              </p>
            ) : null}
          </section>

          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="grid p-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <section className="p-5 sm:p-6" aria-labelledby="mailing-knox-id-title">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-primary" aria-hidden="true" />
                  <h2 id="mailing-knox-id-title" className="text-base font-semibold">수신인 knox_id</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  기본값은 현재 접속자이며, 다른 수신인을 등록할 때 직접 변경할 수 있습니다.
                </p>
                <label htmlFor="mailing-knox-id" className="mb-2 mt-5 block text-xs font-medium">
                  knox_id 입력
                </label>
                <Input
                  id="mailing-knox-id"
                  value={knoxId}
                  onChange={(event) => setKnoxId(event.target.value)}
                  placeholder={currentUserQuery.isLoading ? "접속자 정보를 확인하는 중…" : "knox_id를 입력하세요"}
                  className="h-12 max-w-xl text-base font-semibold"
                  aria-invalid={Boolean(knoxId && !validInputKnoxId)}
                />
                <p className={cn(
                  "mt-2 text-xs",
                  knoxId && !validInputKnoxId ? "text-destructive" : "text-muted-foreground",
                )}>
                  {knoxId && !validInputKnoxId
                    ? "영문, 숫자, 점(.), 밑줄(_), 하이픈(-)만 입력할 수 있습니다."
                    : currentUserQuery.isError
                      ? `현재 접속자 조회 오류: ${currentUserQuery.error.message}`
                      : "email 테이블의 email 컬럼에 knox_id가 저장됩니다."}
                </p>
              </section>
              <section className="border-t p-5 sm:p-6 lg:border-l lg:border-t-0" aria-labelledby="mailing-selection-title">
                <h2 id="mailing-selection-title" className="text-base font-semibold">등록 예정 조건</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  priority는 정책에 따라 A, B, D, M, N으로 고정됩니다.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <SelectionItem
                    label="Line Name"
                    value={formatLineDisplayName(selectedLine)}
                    complete={Boolean(selectedLine)}
                  />
                  <SelectionItem label="SDWT" value={selectedSdwtLabel} complete={resolvedSdwts.length > 0} />
                  <SelectionItem label="knox_id" value={normalizedInputKnoxId} complete={validInputKnoxId} />
                  <SelectionItem label="Grade (priority)" value={MAILING_PRIORITIES.join(", ")} complete />
                </div>
              </section>
            </CardContent>
          </Card>

          <section className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
            <div>
              <h2 className="text-sm font-semibold">등록할 Mailing 조건을 확인하세요.</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                SDWT와 Grade는 각각 JSON list 형식으로 email 테이블의 VARCHAR 컬럼에 저장됩니다.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="h-14 min-w-64 rounded-xl text-base shadow-lg shadow-primary/15"
              disabled={!isReadyToSave || registrationMutation.isPending}
              onClick={handleSave}
            >
              {registrationMutation.isPending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-5" aria-hidden="true" />
              )}
              {registrationMutation.isPending ? "등록 중…" : "Mailing 기능 등록"}
            </Button>
          </section>

          <section className="grid gap-3" aria-labelledby="registered-mailing-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="registered-mailing-title" className="text-base font-semibold">등록된 Mailing 조건</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {validLookupKnoxId || "현재 knox_id"} 기준으로 Line, SDWT, Grade를 각각 분리한 결과입니다.
                </p>
              </div>
              <Badge variant="secondary">{registrationRows.length.toLocaleString()}건</Badge>
            </div>

            {!validLookupKnoxId ? (
              <Card className="grid min-h-28 place-items-center px-5 py-6 text-center text-sm text-muted-foreground">
                조회할 knox_id를 입력하세요.
              </Card>
            ) : registrationsQuery.isLoading ? (
              <Card className="grid min-h-28 place-items-center py-6 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-label="등록 조건 로딩 중" />
              </Card>
            ) : registrationsQuery.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                등록 조건 조회 오류: {registrationsQuery.error.message}
              </div>
            ) : registrationRows.length ? (
              <Card className="gap-0 overflow-hidden py-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-16 text-right">#</TableHead>
                        <TableHead>Line Name</TableHead>
                        <TableHead>SDWT</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead className="w-36 text-right">URL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrationRows.map((row, index) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.line ? formatLineDisplayName(row.line) : "매핑 미확인"}
                          </TableCell>
                          <TableCell>{row.sdwt}</TableCell>
                          <TableCell><Badge variant="outline">{row.grade}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!row.line}
                              onClick={() => showUrl(row)}
                            >
                              <Link2 className="size-3.5" aria-hidden="true" />
                              링크확인
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : (
              <Card className="grid min-h-28 place-items-center px-5 py-6 text-center text-sm text-muted-foreground">
                {validLookupKnoxId}에 등록된 Mailing 조건이 없습니다.
              </Card>
            )}
          </section>
        </div>
      </main>

      <Dialog open={Boolean(urlTarget)} onOpenChange={(open) => !open && setUrlTarget(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>실제 호출 URL</DialogTitle>
            <DialogDescription>
              선택한 Line, SDWT, Grade 한 건만 쿼리 파라미터에 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
              <div><span className="text-muted-foreground">Line</span><p className="mt-1 font-semibold">{urlTarget?.line}</p></div>
              <div><span className="text-muted-foreground">SDWT</span><p className="mt-1 font-semibold">{urlTarget?.sdwt}</p></div>
              <div><span className="text-muted-foreground">Grade</span><p className="mt-1 font-semibold">{urlTarget?.grade}</p></div>
            </div>
            <code className="max-h-40 overflow-auto break-all rounded-lg border bg-muted px-4 py-3 text-xs leading-6">
              {urlTarget?.absoluteUrl}
            </code>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUrlTarget(null)}>닫기</Button>
            <Button type="button" asChild>
              <a href={urlTarget?.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                URL 열기
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(saveFailure)} onOpenChange={(open) => !open && setSaveFailure(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mailing 등록 실패 데이터</DialogTitle>
            <DialogDescription>{saveFailure?.message}</DialogDescription>
          </DialogHeader>
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>email</TableHead>
                  <TableHead>sdwt</TableHead>
                  <TableHead>priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs">{saveFailure?.row?.email}</TableCell>
                  <TableCell className="max-w-52 break-all font-mono text-xs">{saveFailure?.row?.sdwt}</TableCell>
                  <TableCell className="font-mono text-xs">{saveFailure?.row?.priority}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveFailure(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
