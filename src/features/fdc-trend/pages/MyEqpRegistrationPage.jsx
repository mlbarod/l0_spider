import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Loader2,
  MessageSquareText,
  Save,
  Search,
  Settings2,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { fetchLineMapping } from "../api/mappingConfigApi"
import { fetchMyEqpReference } from "../api/myEqpReferenceApi"
import { SPIDER_LINE_REV } from "../utils/fdcTrendMockData"
import { formatLineDisplayName } from "../utils/lineDisplay.mjs"

const EMPTY_MAPPING = Object.freeze({})
const EMPTY_LIST = Object.freeze([])

function matchesQuery(value, query) {
  return String(value).toLocaleLowerCase("ko").includes(query.trim().toLocaleLowerCase("ko"))
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
      "min-h-[300px] gap-0 overflow-hidden py-0 transition-shadow",
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
      <CardContent className="max-h-[218px] min-h-0 flex-1 overflow-y-auto bg-background/60 p-2.5">
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

export function MyEqpRegistrationPage() {
  const [selectedLine, setSelectedLine] = useState("")
  const [selectedSdwt, setSelectedSdwt] = useState("")
  const [selectedPrcGroup, setSelectedPrcGroup] = useState("")
  const [selectedEqps, setSelectedEqps] = useState([])
  const [monitoringDays, setMonitoringDays] = useState("")
  const [comment, setComment] = useState("")
  const [queries, setQueries] = useState({ line: "", sdwt: "", prcGroup: "", eqp: "" })

  const mappingQuery = useQuery({
    queryKey: ["l0-spider-line-mapping"],
    queryFn: fetchLineMapping,
  })
  const referenceQuery = useQuery({
    queryKey: ["my-eqp-reference"],
    queryFn: fetchMyEqpReference,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const lineMapping = mappingQuery.data?.line_mapping ?? SPIDER_LINE_REV
  const sdwtMapping = mappingQuery.data?.sdwt_mapping ?? EMPTY_MAPPING
  const lines = useMemo(
    () => Array.from(new Set(Object.values(lineMapping))).sort((left, right) => (
      left.localeCompare(right, "ko", { numeric: true })
    )),
    [lineMapping],
  )
  const activeLine = lines.includes(selectedLine) ? selectedLine : (lines[0] ?? "")
  const sdwtOptions = useMemo(() => Object.entries(lineMapping)
    .filter(([, line]) => line === activeLine)
    .map(([value]) => ({ value, label: sdwtMapping[value] ?? value }))
    .sort((left, right) => left.label.localeCompare(right.label, "ko", { numeric: true })),
  [activeLine, lineMapping, sdwtMapping])
  const activeSdwt = sdwtOptions.some((option) => option.value === selectedSdwt)
    ? selectedSdwt
    : (sdwtOptions[0]?.value ?? "")
  const activeSdwtLabel = sdwtOptions.find((option) => option.value === activeSdwt)?.label ?? ""

  const sdwtReferenceRows = useMemo(() => (referenceQuery.data ?? []).filter((row) => (
    row.sdwt_prod === activeSdwtLabel || row.sdwt_prod === activeSdwt
  )), [activeSdwt, activeSdwtLabel, referenceQuery.data])
  const prcGroups = useMemo(() => Array.from(new Set(
    sdwtReferenceRows.map((row) => row.prc_group).filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, "ko", { numeric: true })), [sdwtReferenceRows])
  const activePrcGroup = prcGroups.includes(selectedPrcGroup) ? selectedPrcGroup : ""
  const eqpRows = useMemo(() => {
    const seen = new Set()
    return sdwtReferenceRows
      .filter((row) => row.prc_group === activePrcGroup)
      .map((row) => ({ ...row, label: `${row.main}_${row.disp_name}` }))
      .filter((row) => {
        if (seen.has(row.label)) return false
        seen.add(row.label)
        return true
      })
      .sort((left, right) => left.label.localeCompare(right.label, "ko", { numeric: true }))
  }, [activePrcGroup, sdwtReferenceRows])
  const eqpValues = useMemo(() => new Set(eqpRows.map((row) => row.label)), [eqpRows])
  const activeEqps = selectedEqps.filter((eqp) => eqpValues.has(eqp))

  const lineOptions = lines
    .map((line) => ({ value: line, label: formatLineDisplayName(line) }))
    .filter((option) => matchesQuery(option.label, queries.line))
  const visibleSdwtOptions = sdwtOptions.filter((option) => matchesQuery(option.label, queries.sdwt))
  const prcGroupOptions = prcGroups
    .map((group) => ({ value: group, label: group }))
    .filter((option) => matchesQuery(option.label, queries.prcGroup))
  const eqpOptions = eqpRows
    .map((row) => ({ value: row.label, label: row.label }))
    .filter((option) => matchesQuery(option.label, queries.eqp))

  const selectedEqpLabel = activeEqps.join(", ")
  const parsedMonitoringDays = Number(monitoringDays)
  const hasValidMonitoringDays = Number.isInteger(parsedMonitoringDays) && parsedMonitoringDays > 0
  const isReadyToSave = Boolean(
    activeLine && activeSdwt && activePrcGroup && activeEqps.length > 0 && hasValidMonitoringDays,
  )

  const changeQuery = (key, value) => {
    setQueries((current) => ({ ...current, [key]: value }))
  }

  const handleLineChange = (line) => {
    setSelectedLine(line)
    setSelectedSdwt("")
    setSelectedPrcGroup("")
    setSelectedEqps([])
    setQueries((current) => ({ ...current, sdwt: "", prcGroup: "", eqp: "" }))
  }

  const handleSdwtChange = (sdwt) => {
    setSelectedSdwt(sdwt)
    setSelectedPrcGroup("")
    setSelectedEqps([])
    setQueries((current) => ({ ...current, prcGroup: "", eqp: "" }))
  }

  const handlePrcGroupChange = (prcGroup) => {
    setSelectedPrcGroup(prcGroup)
    setSelectedEqps([])
    setQueries((current) => ({ ...current, eqp: "" }))
  }

  const toggleEqp = (eqp) => {
    setSelectedEqps((current) => (
      current.includes(eqp)
        ? current.filter((item) => item !== eqp)
        : [...current, eqp]
    ))
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-muted/30">
      <header className="shrink-0 border-b bg-card px-5 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Settings2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">My EQP 등록</h1>
                <Badge variant="outline" className="gap-1.5 text-[11px]">
                  <Database className="size-3" aria-hidden="true" />
                  erdtsum_info 읽기 전용
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                자설비 이상감지에서 집중 모니터링할 설비와 조회 기간을 등록합니다.
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
          <section aria-labelledby="filter-title">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="filter-title" className="text-base font-semibold">설비 기준정보 선택</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  왼쪽부터 순서대로 선택하면 다음 조건이 활성화됩니다.
                </p>
              </div>
              <p className="rounded-full bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
                EQP 표시 형식: main_disp_name
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <FilterPanel
                step="1"
                title="Line Name"
                description="모니터링 대상 라인을 선택하세요."
                options={lineOptions}
                selectedValue={activeLine}
                onSelect={handleLineChange}
                query={queries.line}
                onQueryChange={(value) => changeQuery("line", value)}
                disabled={mappingQuery.isLoading || lines.length === 0}
                isLoading={mappingQuery.isFetching}
                emptyMessage="선택 가능한 Line이 없습니다."
              />
              <FilterPanel
                step="2"
                title="SDWT"
                description="선택 Line의 SDWT를 선택하세요."
                options={visibleSdwtOptions}
                selectedValue={activeSdwt}
                onSelect={handleSdwtChange}
                query={queries.sdwt}
                onQueryChange={(value) => changeQuery("sdwt", value)}
                disabled={!activeLine}
                emptyMessage="Line Name을 먼저 선택하세요."
              />
              <FilterPanel
                step="3"
                title="PRC Group"
                description="SDWT에 연결된 공정 그룹입니다."
                options={prcGroupOptions}
                selectedValue={activePrcGroup}
                onSelect={handlePrcGroupChange}
                query={queries.prcGroup}
                onQueryChange={(value) => changeQuery("prcGroup", value)}
                disabled={!activeSdwt || referenceQuery.isLoading}
                isLoading={referenceQuery.isFetching}
                emptyMessage={activeSdwt ? "해당 SDWT의 PRC Group이 없습니다." : "SDWT를 먼저 선택하세요."}
              />
              <FilterPanel
                step="4"
                title="EQP"
                description="모니터링할 설비를 복수 선택할 수 있습니다."
                options={eqpOptions}
                selectedValues={activeEqps}
                multiple
                onSelect={toggleEqp}
                query={queries.eqp}
                onQueryChange={(value) => changeQuery("eqp", value)}
                disabled={!activePrcGroup || referenceQuery.isLoading}
                isLoading={referenceQuery.isFetching && Boolean(activePrcGroup)}
                emptyMessage={activePrcGroup ? "해당 PRC Group의 EQP가 없습니다." : "PRC Group을 먼저 선택하세요."}
              />
            </div>

            {mappingQuery.isError || referenceQuery.isError ? (
              <div className="mt-3 grid gap-2">
                {mappingQuery.isError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                    기준정보 매핑 오류: {mappingQuery.error.message}
                  </p>
                ) : null}
                {referenceQuery.isError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                    erdtsum_info 조회 오류: {referenceQuery.error.message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <Card className="gap-4 py-5">
            <CardHeader className="gap-1 px-5 sm:px-6">
              <CardTitle className="text-base">선택 조건</CardTitle>
              <CardDescription className="text-xs">현재 등록할 My EQP 기준정보입니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
              <SelectionItem label="Line Name" value={formatLineDisplayName(activeLine)} complete={Boolean(activeLine)} />
              <SelectionItem label="SDWT" value={activeSdwtLabel} complete={Boolean(activeSdwt)} />
              <SelectionItem label="PRC Group" value={activePrcGroup} complete={Boolean(activePrcGroup)} />
              <SelectionItem label="EQP" value={selectedEqpLabel} complete={activeEqps.length > 0} />
            </CardContent>
          </Card>

          <Card className="gap-4 py-5">
            <CardHeader className="gap-1 px-5 sm:px-6">
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-base">모니터링 기간</CardTitle>
              </div>
              <CardDescription className="text-xs">자설비 이상감지에서 조회할 최근 기간을 일 단위로 입력하세요.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 sm:px-6">
              <div className="max-w-md">
                <label htmlFor="monitoring-days" className="mb-2 block text-xs font-medium text-foreground">
                  기간 입력
                </label>
                <div className="relative">
                  <Input
                    id="monitoring-days"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={monitoringDays}
                    onChange={(event) => setMonitoringDays(event.target.value)}
                    placeholder="모니터링 기간을 입력하세요"
                    className="h-12 pr-14 text-base font-semibold"
                    aria-describedby="monitoring-days-help"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    일
                  </span>
                </div>
                <p id="monitoring-days-help" className={cn(
                  "mt-2 text-xs",
                  monitoringDays && !hasValidMonitoringDays ? "text-destructive" : "text-muted-foreground",
                )}>
                  {monitoringDays && !hasValidMonitoringDays
                    ? "1 이상의 정수로 입력하세요."
                    : "1 이상의 일수를 직접 입력할 수 있습니다."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4 py-5">
            <CardHeader className="gap-1 px-5 sm:px-6">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-base">Comment</CardTitle>
              </div>
              <CardDescription className="text-xs">My EQP 기준정보에 필요한 설명이나 참고사항을 입력하세요.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 sm:px-6">
              <div className="max-w-3xl">
                <label htmlFor="my-eqp-comment" className="mb-2 block text-xs font-medium text-foreground">
                  비고 입력 <span className="font-normal text-muted-foreground">(선택)</span>
                </label>
                <Textarea
                  id="my-eqp-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="설비 선택 사유나 모니터링 시 참고할 내용을 입력하세요."
                  className="min-h-28 resize-y text-sm leading-6"
                />
              </div>
            </CardContent>
          </Card>

          <section className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
            <div>
              <h2 className="text-sm font-semibold">등록할 기준정보를 확인하세요.</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                모든 조건과 모니터링 기간을 입력하면 저장 버튼이 활성화됩니다.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="h-12 min-w-52 rounded-xl text-base shadow-lg shadow-primary/15"
              disabled={!isReadyToSave}
            >
              <Save className="size-5" aria-hidden="true" />
              My EQP 저장
            </Button>
          </section>
        </div>
      </main>
    </div>
  )
}
