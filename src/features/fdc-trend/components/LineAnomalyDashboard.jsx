import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

import { fetchDashboardSummary } from "../api/dashboardApi"
import { formatLineDisplayName } from "../utils/lineDisplay.mjs"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#2563eb",
  "#0f766e",
  "#7c3aed",
]
const MAX_TREND_LINES = 8
const TABLE_PAGE_SIZE = 8
const TREND_PERIOD_OPTIONS = Object.freeze([10, 30, 90, 180])

function formatCount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString("ko-KR") : "—"
}

function formatDisplayDate(value) {
  return value ? value.replaceAll("-", ".") : "—"
}

function formatDisplayDateTime(value) {
  if (!value) return "—"
  return `${formatDisplayDate(value.slice(0, 10))} ${value.slice(11)}`
}

function getPresetStartDate(endDate, days) {
  const date = new Date(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return endDate
  date.setUTCDate(date.getUTCDate() - (days - 1))
  return date.toISOString().slice(0, 10)
}

function compareValues(left, right, key) {
  const leftValue = left[key]
  const rightValue = right[key]
  if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue
  if (key === "lastAbnormalDate") {
    return Date.parse(`${leftValue ?? "1970-01-01"}T00:00:00Z`)
      - Date.parse(`${rightValue ?? "1970-01-01"}T00:00:00Z`)
  }
  return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "ko", { numeric: true })
}

function ChangeText({ value, emptyText = "비교 데이터 없음", className }) {
  if (value === null || value === undefined) {
    return <span className={cn("text-muted-foreground", className)}>{emptyText}</span>
  }
  if (value > 0) {
    return <span className={cn("text-amber-600 dark:text-amber-400", className)}>▲ {formatCount(value)}건</span>
  }
  if (value < 0) {
    return <span className={cn("text-emerald-600 dark:text-emerald-400", className)}>▼ {formatCount(Math.abs(value))}건</span>
  }
  return <span className={cn("text-muted-foreground", className)}>변동 없음</span>
}

function KpiCard({ label, value, unit, description, valueClassName }) {
  return (
    <article className="grid min-h-[108px] grid-rows-[auto_1fr_auto] rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex min-w-0 items-end gap-1.5 py-1">
        <strong className={cn("truncate text-2xl font-semibold tracking-tight tabular-nums", valueClassName)}>
          {value}
        </strong>
        {unit ? <span className="pb-0.5 text-xs font-medium text-muted-foreground">{unit}</span> : null}
      </div>
      <p className="truncate text-[11px] text-muted-foreground">{description}</p>
    </article>
  )
}

function DashboardTooltip({ active, payload, label, type }) {
  if (!active || !payload?.length) return null
  if (type === "bar") {
    const row = payload[0]?.payload
    return (
      <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold">{formatLineDisplayName(row?.lineId)}</p>
        <p className="mt-1 text-muted-foreground">이상 건수 <strong className="text-foreground">{formatCount(row?.totalCount)}건</strong></p>
      </div>
    )
  }

  return (
    <div className="min-w-40 rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold">{formatDisplayDate(label)}</p>
      <div className="grid gap-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <strong className="tabular-nums text-foreground">{formatCount(entry.value)}건</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyChart({ message = "조회 조건에 해당하는 데이터가 없습니다." }) {
  return (
    <div className="grid h-[310px] place-items-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function LineMultiSelect({ lines, selectedLines, onChange, disabled }) {
  const isAllSelected = selectedLines.length === 0

  function toggleLine(line, checked) {
    let nextLines
    if (isAllSelected) {
      nextLines = checked ? [line] : lines.filter((item) => item !== line)
    } else {
      nextLines = checked
        ? [...selectedLines, line]
        : selectedLines.filter((item) => item !== line)
    }
    const uniqueLines = Array.from(new Set(nextLines))
    onChange(uniqueLines.length === lines.length ? [] : uniqueLines)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between px-3" disabled={disabled}>
          <span className="truncate">{isAllSelected ? "전체 라인" : `${selectedLines.length}개 라인 선택`}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
        <DropdownMenuLabel>라인 선택</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={isAllSelected}
          onCheckedChange={() => onChange([])}
          onSelect={(event) => event.preventDefault()}
        >
          전체 라인
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {lines.map((line) => (
          <DropdownMenuCheckboxItem
            key={line}
            checked={isAllSelected || selectedLines.includes(line)}
            onCheckedChange={(checked) => toggleLine(line, checked)}
            onSelect={(event) => event.preventDefault()}
          >
            {formatLineDisplayName(line)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortButton({ column, label, sortConfig, onSort }) {
  const active = sortConfig.key === column
  const Icon = active ? (sortConfig.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => onSort(column)}>
      {label}
      <Icon className={cn("size-3.5", !active && "text-muted-foreground/60")} />
    </button>
  )
}

function LineSummaryTable({ rows }) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: "totalCount", direction: "desc" })
  const normalizedSearch = search.trim().toLocaleLowerCase("ko")
  const sortedRows = useMemo(() => {
    const filteredRows = normalizedSearch
      ? rows.filter((row) => formatLineDisplayName(row.lineId).toLocaleLowerCase("ko").includes(normalizedSearch))
      : rows
    return [...filteredRows].sort((left, right) => {
      const result = compareValues(left, right, sortConfig.key)
      return sortConfig.direction === "asc" ? result : -result
    })
  }, [normalizedSearch, rows, sortConfig])
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / TABLE_PAGE_SIZE))
  const activePage = Math.min(page, pageCount)
  const visibleRows = sortedRows.slice((activePage - 1) * TABLE_PAGE_SIZE, activePage * TABLE_PAGE_SIZE)

  function handleSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }))
    setPage(1)
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">라인별 상세 현황</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">전체 이상 건수 내림차순 · 라인 선택 시 상세 화면 이동</p>
        </div>
        <label className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="라인명 검색"
            className="pl-9"
          />
        </label>
      </div>
      <div className="max-h-[390px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="bg-muted/40">
              <TableHead><SortButton column="lineId" label="라인" sortConfig={sortConfig} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortButton column="totalCount" label="전체 이상 건수" sortConfig={sortConfig} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortButton column="abGradeCount" label="A/B Grade 이상건수" sortConfig={sortConfig} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortButton column="latestDateCount" label="최신일 이상 건수" sortConfig={sortConfig} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortButton column="changeCount" label="전일 대비" sortConfig={sortConfig} onSort={handleSort} /></TableHead>
              <TableHead><SortButton column="lastAbnormalDate" label="최근 이상 발생일" sortConfig={sortConfig} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortButton column="ratio" label="전체 대비 비율" sortConfig={sortConfig} onSort={handleSort} /></TableHead>
              <TableHead className="w-28 text-center">상세 보기</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length ? visibleRows.map((row) => (
              <TableRow key={row.lineId}>
                <TableCell className="font-semibold">{formatLineDisplayName(row.lineId)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.totalCount)}건</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.abGradeCount)}건</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.latestDateCount)}건</TableCell>
                <TableCell className="text-right"><ChangeText value={row.changeCount} className="text-xs font-medium" /></TableCell>
                <TableCell>{formatDisplayDate(row.lastAbnormalDate)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.ratio.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%</TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/self-equipment?line=${encodeURIComponent(row.lineId)}`}>
                      상세 <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                  {search ? "검색 결과가 없습니다." : "조회 조건에 해당하는 라인 데이터가 없습니다."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span>총 {formatCount(sortedRows.length)}개 라인</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={activePage <= 1}>이전</Button>
          <span className="min-w-16 text-center tabular-nums">{activePage} / {pageCount}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={activePage >= pageCount}>다음</Button>
        </div>
      </div>
    </section>
  )
}

export function LineAnomalyDashboard() {
  const [appliedFilters, setAppliedFilters] = useState({})
  const [draftLines, setDraftLines] = useState([])
  const [hiddenLines, setHiddenLines] = useState(() => new Set())
  const [trendPeriodDays, setTrendPeriodDays] = useState(10)
  const dashboardQuery = useQuery({
    queryKey: [
      "spider-line-dashboard",
      (appliedFilters.lines ?? []).join("\u0000"),
    ],
    queryFn: ({ signal }) => fetchDashboardSummary({ ...appliedFilters, signal }),
    staleTime: 60 * 1000,
    retry: false,
    placeholderData: (previousData) => previousData,
  })
  const dashboard = dashboardQuery.data?.lineDashboard
  const trendPresetFilters = useMemo(() => {
    if (!dashboard) return null
    const endDate = dashboard.options.maxDate
    return {
      startDate: getPresetStartDate(endDate, trendPeriodDays),
      endDate,
      lines: dashboard.filters.lines ?? [],
    }
  }, [dashboard, trendPeriodDays])
  const trendQuery = useQuery({
    queryKey: [
      "spider-line-dashboard-trend",
      trendPeriodDays,
      trendPresetFilters?.startDate ?? "",
      trendPresetFilters?.endDate ?? "",
      (trendPresetFilters?.lines ?? []).join("\u0000"),
    ],
    queryFn: ({ signal }) => fetchDashboardSummary({ ...trendPresetFilters, signal }),
    enabled: Boolean(trendPresetFilters),
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: (previousData) => previousData,
  })
  const trendDashboard = trendQuery.data?.lineDashboard

  const displayedLines = useMemo(
    () => (trendDashboard?.lineSummary ?? []).slice(0, MAX_TREND_LINES).map((row) => row.lineId),
    [trendDashboard?.lineSummary],
  )
  const trendRows = useMemo(() => {
    const visibleLineSet = new Set(displayedLines)
    const rowsByDate = new Map()
    ;(trendDashboard?.dailyTrend ?? []).forEach((row) => {
      if (!visibleLineSet.has(row.lineId)) return
      const dateRow = rowsByDate.get(row.date) ?? { date: row.date }
      dateRow[row.lineId] = row.abnormalCount
      rowsByDate.set(row.date, dateRow)
    })
    return Array.from(rowsByDate.values()).sort((left, right) => (
      Date.parse(`${left.date}T00:00:00Z`) - Date.parse(`${right.date}T00:00:00Z`)
    ))
  }, [trendDashboard?.dailyTrend, displayedLines])
  const barRows = useMemo(() => (
    [...(dashboard?.lineSummary ?? [])].sort((left, right) => (
      right.lineId.localeCompare(left.lineId, "ko", { numeric: true })
    ))
  ), [dashboard?.lineSummary])

  function applyFilters(nextLines = draftLines) {
    if (dashboardQuery.isFetching) return
    const nextFilters = { lines: nextLines }
    const isSame = JSON.stringify(nextFilters) === JSON.stringify(appliedFilters)
    setHiddenLines(new Set())
    if (isSame) dashboardQuery.refetch()
    else setAppliedFilters(nextFilters)
  }

  function resetFilters() {
    if (!dashboard) return
    setDraftLines([])
    setHiddenLines(new Set())
    setTrendPeriodDays(10)
    setAppliedFilters({})
  }

  function selectLine(lineId) {
    if (!lineId || dashboardQuery.isFetching) return
    setDraftLines([lineId])
    setHiddenLines(new Set())
    setAppliedFilters({ lines: [lineId] })
  }

  if (dashboardQuery.isPending && !dashboard) {
    return (
      <section className="mt-6 grid min-h-[420px] place-items-center border-t-2 border-border/80 pt-9">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> 라인별 대시보드를 불러오는 중입니다.
        </div>
      </section>
    )
  }

  if (dashboardQuery.isError && !dashboard) {
    return (
      <section className="mt-6 grid gap-4 border-t-2 border-border/80 pt-9">
        <h2 className="text-xl font-semibold tracking-tight">라인별 이상 현황 Dashboard</h2>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm text-destructive">
          {dashboardQuery.error.message}
        </div>
      </section>
    )
  }

  const summary = dashboard.summary
  const lineRows = dashboard.lineSummary
  const options = dashboard.options
  const trendLineRows = trendDashboard?.lineSummary ?? []
  const trendRangeLabel = trendDashboard
    ? `${formatDisplayDate(trendDashboard.filters.startDate)} ~ ${formatDisplayDate(trendDashboard.filters.endDate)}`
    : "추이 조회 중"
  return (
    <section className="relative mt-6 grid gap-5 border-t-2 border-border/80 pt-9" aria-busy={dashboardQuery.isFetching}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">라인별 이상 현황 Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            SDWT 기준정보를 라인으로 매핑한 뒤 5개 식별값으로 중복 제거한 일자별 이상건수입니다.
          </p>
        </div>
        <Badge variant="outline" className="h-7 px-3">
          최신 데이터 {summary.latestDateTime ? formatDisplayDateTime(summary.latestDateTime) : "없음"}
        </Badge>
      </div>

      <form
        className="grid items-end gap-3 rounded-xl border bg-card p-4 shadow-sm lg:grid-cols-[minmax(260px,1fr)_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          applyFilters()
        }}
      >
        <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          라인 선택
          <LineMultiSelect lines={options.lines} selectedLines={draftLines} onChange={setDraftLines} disabled={!options.lines.length} />
        </div>
        <Button type="submit" disabled={dashboardQuery.isFetching}>
          {dashboardQuery.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          조회
        </Button>
        <Button type="button" variant="outline" onClick={resetFilters} disabled={dashboardQuery.isFetching}>
          <RotateCcw className="size-4" /> 초기화
        </Button>
      </form>

      {dashboardQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {dashboardQuery.error.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <KpiCard label="모니터링 센서 총합" value={formatCount(summary.monitoringSensorTotal)} unit="개" description="조회 최신 시각 · TL total 합계" />
        <KpiCard label="전체 이상 건수" value={formatCount(summary.totalAbnormalCount)} unit="건" description={`${formatDisplayDate(dashboard.filters.startDate)} ~ ${formatDisplayDate(dashboard.filters.endDate)}`} />
        <KpiCard label="A/B Grade" value={formatCount(summary.abGradeCount)} unit="건" description="A · B Grade 고유건수" />
        <KpiCard label="D Grade" value={formatCount(summary.dGradeCount)} unit="건" description="D Grade 고유건수" />
        <KpiCard label="N Grade" value={formatCount(summary.nGradeCount)} unit="건" description="N Grade 고유건수" />
        <KpiCard label="M Grade" value={formatCount(summary.mGradeCount)} unit="건" description="M Grade 고유건수" />
        <KpiCard
          label="전일 대비"
          value={<ChangeText value={summary.changeFromPreviousDay} className="text-xl xl:text-2xl" />}
          description={summary.previousDateTime
            ? `${formatDisplayDateTime(summary.previousDateTime)} 대비`
            : "동일 시각 비교 데이터 없음"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">라인별 이상 건수</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">선택 기간 누적 · 라인명 내림차순 · 막대 끝 건수 표시</p>
          </div>
          <div className="h-[330px] overflow-y-auto p-3">
            {barRows.length ? (
              <div style={{ height: Math.max(300, barRows.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barRows} layout="vertical" margin={{ top: 4, right: 68, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis type="category" dataKey="lineId" tickFormatter={formatLineDisplayName} width={105} tick={{ fontSize: 12, fill: "var(--foreground)" }} interval={0} />
                    <Tooltip content={<DashboardTooltip type="bar" />} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
                    <Bar
                      dataKey="totalCount"
                      name="이상 건수"
                      fill="var(--primary)"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={22}
                      className="cursor-pointer"
                      isAnimationActive={false}
                      onClick={(entry) => selectLine(entry?.lineId ?? entry?.payload?.lineId)}
                    >
                      <LabelList
                        dataKey="totalCount"
                        position="right"
                        formatter={(value) => `${formatCount(value)}건`}
                        style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart />}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">라인별 일자별 이상 건수 추이</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {trendRangeLabel} · {trendLineRows.length > MAX_TREND_LINES ? `상위 ${MAX_TREND_LINES}개 라인 표시` : "범례 클릭으로 표시 전환"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {TREND_PERIOD_OPTIONS.map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="sm"
                  variant={trendPeriodDays === days ? "default" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  disabled={trendQuery.isFetching && trendPeriodDays === days}
                  onClick={() => {
                    setTrendPeriodDays(days)
                    setHiddenLines(new Set())
                    if (trendPeriodDays === days) trendQuery.refetch()
                  }}
                >
                  {trendQuery.isFetching && trendPeriodDays === days
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <CalendarDays className="size-3.5" />}
                  {days}일
                </Button>
              ))}
            </div>
          </div>
          <div className="h-[330px] p-3">
            {trendQuery.isPending && !trendDashboard ? (
              <div className="grid h-[310px] place-items-center text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> 과거 추이를 불러오는 중입니다.</span>
              </div>
            ) : trendQuery.isError ? (
              <EmptyChart message={trendQuery.error.message} />
            ) : displayedLines.length && trendRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows} margin={{ top: 8, right: 18, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => value.slice(5)}
                    minTickGap={26}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis allowDecimals={false} width={46} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip content={<DashboardTooltip type="line" />} />
                  <Legend
                    iconType="line"
                    wrapperStyle={{ fontSize: 12, paddingTop: 8, cursor: "pointer" }}
                    onClick={(entry) => {
                      const lineId = entry.dataKey ?? entry.value
                      setHiddenLines((current) => {
                        const next = new Set(current)
                        if (next.has(lineId)) next.delete(lineId)
                        else next.add(lineId)
                        return next
                      })
                    }}
                  />
                  {displayedLines.map((lineId, index) => (
                    <Line
                      key={lineId}
                      type="monotone"
                      dataKey={lineId}
                      name={formatLineDisplayName(lineId)}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={trendRows.length <= 14 ? { r: 2 } : false}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                      hide={hiddenLines.has(lineId)}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </section>
      </div>

      <LineSummaryTable rows={lineRows} />

      {dashboardQuery.isFetching ? (
        <div className="pointer-events-none absolute inset-x-0 top-[82px] z-20 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2 text-xs font-medium shadow-md">
            <Loader2 className="size-4 animate-spin" /> 기존 화면을 유지하면서 조회 중입니다.
          </div>
        </div>
      ) : null}
    </section>
  )
}
