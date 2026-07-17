import { memo, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowUp, Check, ChevronRight, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
  fetchCommonAnomalyData,
  fetchCommonAnomalyScatterData,
} from "../api/commonAnomalyApi"
import { fetchCurrentUser } from "../api/currentUserApi"
import { fetchLineMapping } from "../api/mappingConfigApi"
import { SPIDER_LINE_REV } from "../utils/fdcTrendMockData"

const EMPTY_MAPPING = Object.freeze({})
const EMPTY_LIST = Object.freeze([])
const ALL_EQPS = "ALL"
const CHART_MARGIN = Object.freeze({ top: 42, right: 18, bottom: 28, left: 16 })
const Y_AXIS_WIDTH = 64
const X_AXIS_HEIGHT = 30
const MAX_RENDERED_POINTS = 800

function SelectRow({ label, meta, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-3 rounded-md border border-transparent px-3 text-left transition",
        "hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/30 bg-primary/10 text-primary shadow-sm",
      )}
    >
      <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium", selected && "text-primary")} title={label}>
        {label}
      </span>
      {meta ? <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{meta}</span> : null}
      {selected
        ? <Check className="size-3 shrink-0 text-primary" aria-hidden="true" />
        : <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </button>
  )
}

function FilterCard({
  title,
  badge,
  disabled = false,
  placeholder,
  isActive = false,
  isLoading = false,
  query,
  onQueryChange,
  children,
}) {
  return (
    <Card className={cn(
      "grid min-h-0 min-w-0 grid-rows-[48px_40px_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl border bg-card py-0 shadow-sm",
      isActive && "ring-2 ring-primary/50",
    )}>
      <div className={cn("flex h-12 items-center border-b px-4", isActive ? "bg-primary/10" : "bg-muted/40")}>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <CardTitle className={cn("truncate text-sm font-semibold", disabled && "text-muted-foreground", isActive && "text-primary")}>
            {title}
          </CardTitle>
          {isLoading
            ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="로딩 중" />
            : badge != null
            ? <Badge variant={isActive ? "default" : "secondary"} className="text-[11px]">{badge}</Badge>
            : null}
        </div>
      </div>
      <div className="border-b px-2 py-1.5">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="검색…"
          className="h-7 text-xs"
          disabled={disabled}
        />
      </div>
      <CardContent className="min-h-0 overflow-y-auto overflow-x-hidden bg-background/60 p-2">
        {disabled ? (
          <div className="flex h-full min-h-16 items-center justify-center px-3 text-center text-sm text-muted-foreground">
            {placeholder}
          </div>
        ) : children.length ? (
          <div className="grid content-start gap-1.5">{children}</div>
        ) : (
          <div className="flex h-full min-h-16 items-center justify-center px-3 text-center text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function stripPngExtension(value) {
  return String(value ?? "").replace(/\.png$/i, "")
}

function formatActTimeTick(value) {
  if (Number.isFinite(Number(value))) {
    return new Date(Number(value)).toISOString().slice(0, 10).replaceAll("-", "/")
  }
  return String(value ?? "").slice(0, 10).replaceAll("-", "/")
}

function numericDomain(values, fallbackPadding) {
  const finiteValues = values.filter(Number.isFinite)
  if (!finiteValues.length) return [0, 1]
  const minimum = Math.min(...finiteValues)
  const maximum = Math.max(...finiteValues)
  if (minimum !== maximum) {
    const padding = (maximum - minimum) * 0.025
    return [minimum - padding, maximum + padding]
  }
  const padding = Math.abs(minimum) * 0.05 || fallbackPadding
  return [minimum - padding, maximum + padding]
}

function samplePoints(points) {
  if (points.length <= MAX_RENDERED_POINTS) return points
  const sampled = [points[0]]
  const interval = (points.length - 1) / (MAX_RENDERED_POINTS - 1)
  for (let index = 1; index < MAX_RENDERED_POINTS - 1; index += 1) {
    sampled.push(points[Math.round(index * interval)])
  }
  sampled.push(points.at(-1))
  return sampled
}

function ScatterPointTooltip({ active, payload, axisColumn }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const rows = [
    ["eqp_id", point.eqpId],
    ["disp_name", point.dispName],
    ["lotid", point.lotId],
    ["wafer_id", point.waferId],
    ["act_time", point.actTime],
    [axisColumn, point.value],
  ]
  return (
    <div className="grid gap-1 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-lg">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
          <span className="text-muted-foreground">{label}</span>
          <span className="max-w-64 break-all font-medium">{String(value ?? "-")}</span>
        </div>
      ))}
    </div>
  )
}

function getZoomPoint(event, chart, domains) {
  if (!chart || !event) return null
  const bounds = chart.getBoundingClientRect()
  const plotLeft = CHART_MARGIN.left + Y_AXIS_WIDTH
  const plotRight = bounds.width - CHART_MARGIN.right
  const plotTop = CHART_MARGIN.top
  const plotBottom = bounds.height - CHART_MARGIN.bottom - X_AXIS_HEIGHT
  const pixelX = Math.min(Math.max(event.clientX - bounds.left, plotLeft), plotRight)
  const pixelY = Math.min(Math.max(event.clientY - bounds.top, plotTop), plotBottom)
  const xRatio = (pixelX - plotLeft) / Math.max(plotRight - plotLeft, 1)
  const yRatio = (pixelY - plotTop) / Math.max(plotBottom - plotTop, 1)
  return {
    x: domains.x[0] + xRatio * (domains.x[1] - domains.x[0]),
    y: domains.y[1] - yRatio * (domains.y[1] - domains.y[0]),
    pixelX,
    pixelY,
  }
}

const CommonScatterCard = memo(function CommonScatterCard({ row }) {
  const eqp = stripPngExtension(row.eqp)
  const cardRef = useRef(null)
  const chartRef = useRef(null)
  const zoomStartRef = useRef(null)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [zoomDomain, setZoomDomain] = useState(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setIsNearViewport(true)
      observer.disconnect()
    }, { rootMargin: "600px 0px" })
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  const chartQuery = useQuery({
    queryKey: ["common-anomaly-scatter-data", row.file_path, eqp, row.sensor],
    queryFn: () => fetchCommonAnomalyScatterData({
      filePath: row.file_path,
      eqp,
      sensor: row.sensor,
    }),
    enabled: Boolean(isNearViewport && row.file_path && eqp && row.sensor),
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const points = chartQuery.data?.points ?? EMPTY_LIST
  const axisColumn = chartQuery.data?.axisColumn ?? row.sensor
  const baseDomain = useMemo(() => ({
    x: numericDomain(points.map((point) => point.actTimeMs), 60 * 60 * 1000),
    y: numericDomain(points.map((point) => point.value), 1),
  }), [points])
  const renderedPoints = useMemo(() => {
    const visible = zoomDomain
      ? points.filter((point) => (
          point.actTimeMs >= zoomDomain.x[0]
          && point.actTimeMs <= zoomDomain.x[1]
          && point.value >= zoomDomain.y[0]
          && point.value <= zoomDomain.y[1]
        ))
      : points
    return {
      recent: samplePoints(visible.filter((point) => point.isRecent)),
      previous: samplePoints(visible.filter((point) => !point.isRecent)),
    }
  }, [points, zoomDomain])

  const handlePointerDown = (event) => {
    if (event.button !== 0) return
    const point = getZoomPoint(event, chartRef.current, zoomDomain ?? baseDomain)
    if (!point) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    zoomStartRef.current = point
  }
  const handlePointerUp = (event) => {
    const start = zoomStartRef.current
    if (!start) return
    const end = getZoomPoint(event, chartRef.current, zoomDomain ?? baseDomain)
    if (end && Math.abs(end.pixelX - start.pixelX) > 4 && Math.abs(end.pixelY - start.pixelY) > 4) {
      setZoomDomain({
        x: [Math.min(start.x, end.x), Math.max(start.x, end.x)],
        y: [Math.min(start.y, end.y), Math.max(start.y, end.y)],
      })
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    zoomStartRef.current = null
  }

  return (
    <article ref={cardRef} className="grid min-h-[400px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card shadow-sm">
      <header className="border-b bg-muted/50 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className="shrink-0 text-sm font-semibold">{eqp || "EQP 미지정"}</h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.date || "date 미지정"} · {row.prc_group || "prc_group 미지정"} · {row.sensor || "sensor 미지정"} · {row.step || "step 미지정"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {chartQuery.data ? <Badge variant="secondary">{points.length.toLocaleString()} 매</Badge> : null}
            <Badge variant="outline">{row.priority ? `${row.priority}등급` : "등급 미지정"}</Badge>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" /> 이상감지 data</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-gray-400" /> 이전 데이터</span>
          <span>드래그 확대 · 더블클릭 원복</span>
        </div>
      </header>
      <div className="grid min-h-[320px] place-items-center bg-background p-3">
        {!isNearViewport ? (
          <div className="text-sm text-muted-foreground">화면에 표시할 차트를 준비 중입니다.</div>
        ) : chartQuery.isLoading ? (
          <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            공통부 이상감지 데이터를 불러오는 중입니다.
          </div>
        ) : chartQuery.isError ? (
          <div className="grid max-w-md gap-2 px-4 text-center text-sm text-destructive">
            <span>{chartQuery.error.message}</span>
            {chartQuery.error.sourcePath ? <code className="break-all text-xs">{chartQuery.error.sourcePath}</code> : null}
          </div>
        ) : points.length ? (
          <div
            ref={chartRef}
            className="relative h-[320px] w-full min-w-0 cursor-crosshair select-none touch-none"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { zoomStartRef.current = null }}
            onDoubleClick={() => setZoomDomain(null)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={CHART_MARGIN}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="actTimeMs"
                  type="number"
                  name="act_time"
                  height={X_AXIS_HEIGHT}
                  domain={zoomDomain?.x ?? baseDomain.x}
                  allowDataOverflow={Boolean(zoomDomain)}
                  scale="time"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={formatActTimeTick}
                  label={{ value: "act_time", position: "insideBottom", offset: -18, fontSize: 11 }}
                />
                <YAxis
                  dataKey="value"
                  type="number"
                  name={axisColumn}
                  width={Y_AXIS_WIDTH}
                  domain={zoomDomain?.y ?? baseDomain.y}
                  allowDataOverflow={Boolean(zoomDomain)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                />
                <RechartsTooltip
                  content={<ScatterPointTooltip axisColumn={axisColumn} />}
                  cursor={false}
                  isAnimationActive={false}
                  animationDuration={0}
                />
                <Scatter data={renderedPoints.previous} dataKey="value" fill="#9ca3af" isAnimationActive={false} />
                <Scatter data={renderedPoints.recent} dataKey="value" fill="#ef4444" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid max-w-full justify-items-center gap-3 px-4 text-center text-sm text-muted-foreground">
            <p>{eqp}에 해당하는 유효한 scatter 데이터가 없습니다.</p>
            <code className="max-w-full break-all rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
              {chartQuery.data?.sourcePath ?? row.data_path}
            </code>
            {chartQuery.data?.diagnostics ? (
              <>
                <p className="text-xs">
                  전체 {chartQuery.data.diagnostics.totalRows.toLocaleString()}건 · EQP 매칭 {chartQuery.data.diagnostics.eqpMatchedRows.toLocaleString()}건 ·
                  act_time 제외 {chartQuery.data.diagnostics.invalidActTimeRows.toLocaleString()}건 · sensor 값 제외 {chartQuery.data.diagnostics.invalidValueRows.toLocaleString()}건
                </p>
                {chartQuery.data.diagnostics.availableEqpCbs?.length ? (
                  <p className="max-w-full break-all text-left text-xs">
                    parquet eqp_cb: {chartQuery.data.diagnostics.availableEqpCbs.join(", ")}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2.5">
        <Button type="button" variant="outline" size="sm" disabled title="버튼 기능 정의 예정">SKIP</Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9 px-[0.9rem] text-sm" disabled title="버튼 기능 정의 예정">동일성 차트</Button>
          <Button type="button" variant="outline" size="sm" className="h-9 px-[0.9rem] text-sm" disabled title="버튼 기능 정의 예정">이력저장</Button>
        </div>
      </footer>
    </article>
  )
})

function filterItems(items, query) {
  const normalizedQuery = query.trim().toLowerCase()
  return normalizedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : items
}

export function CommonAnomalyPage() {
  const pageRef = useRef(null)
  const [selectedLine, setSelectedLine] = useState("")
  const [selectedTeam, setSelectedTeam] = useState("")
  const [selectedPrcGroup, setSelectedPrcGroup] = useState("")
  const [selectedEqp, setSelectedEqp] = useState("")
  const [selectedSensor, setSelectedSensor] = useState("")
  const [queries, setQueries] = useState({ line: "", team: "", prcGroup: "", eqp: "", sensor: "" })
  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
    retry: false,
  })
  const mappingQuery = useQuery({
    queryKey: ["l0-spider-line-mapping"],
    queryFn: fetchLineMapping,
  })
  const lineMapping = mappingQuery.data?.line_mapping ?? SPIDER_LINE_REV
  const sdwtMapping = mappingQuery.data?.sdwt_mapping ?? EMPTY_MAPPING
  const lines = useMemo(() => Array.from(new Set(Object.values(lineMapping))), [lineMapping])
  const activeLine = lines.includes(selectedLine) ? selectedLine : (lines[0] ?? "")
  const teamOptions = useMemo(
    () => Object.entries(lineMapping)
      .filter(([, line]) => line === activeLine)
      .map(([key]) => ({ key, label: sdwtMapping[key] ?? key })),
    [activeLine, lineMapping, sdwtMapping],
  )
  const activeTeam = teamOptions.some((team) => team.key === selectedTeam)
    ? selectedTeam
    : (teamOptions[0]?.key ?? "")
  const activeTeamLabel = teamOptions.find((team) => team.key === activeTeam)?.label ?? ""
  const dataQuery = useQuery({
    queryKey: [
      "common-anomaly-data",
      activeLine,
      activeTeam,
      activeTeamLabel,
      selectedPrcGroup,
      selectedEqp,
      selectedSensor,
    ],
    queryFn: () => fetchCommonAnomalyData({
      line: activeLine,
      pathSdwt: activeTeam,
      sdwt: activeTeamLabel,
      prcGroup: selectedPrcGroup,
      eqp: selectedEqp,
      sensor: selectedSensor,
    }),
    enabled: Boolean(activeLine && activeTeam && activeTeamLabel),
  })
  const prcGroups = dataQuery.data?.prcGroups ?? EMPTY_LIST
  const eqps = dataQuery.data?.eqps ?? EMPTY_LIST
  const sensors = dataQuery.data?.sensors ?? EMPTY_LIST
  const activePrcGroup = dataQuery.data?.filters?.prcGroup ?? ""
  const activeEqp = dataQuery.data?.filters?.eqp ?? ""
  const activeSensor = dataQuery.data?.filters?.sensor ?? ""
  const sensorIsSelected = Boolean(selectedSensor && activeSensor === selectedSensor)
  const chartRows = sensorIsSelected ? dataQuery.data?.rows ?? EMPTY_LIST : EMPTY_LIST
  const chartGroups = useMemo(() => {
    const groups = new Map()
    chartRows.forEach((row) => {
      const eqp = stripPngExtension(row.eqp) || "EQP 미지정"
      const groupRows = groups.get(eqp) ?? []
      groupRows.push(row)
      groups.set(eqp, groupRows)
    })
    return Array.from(groups, ([eqp, rows]) => ({ eqp, rows }))
      .sort((left, right) => left.eqp.localeCompare(right.eqp, "ko", { numeric: true }))
  }, [chartRows])

  const setQuery = (key, value) => setQueries((current) => ({ ...current, [key]: value }))
  const resetAfterTeam = () => {
    setSelectedPrcGroup("")
    setSelectedEqp("")
    setSelectedSensor("")
    setQueries((current) => ({ ...current, prcGroup: "", eqp: "", sensor: "" }))
  }
  const filteredLines = filterItems(lines.map((value) => ({ value, label: value })), queries.line)
  const filteredTeams = filterItems(teamOptions.map((team) => ({ value: team.key, label: team.label })), queries.team)
  const filteredPrcGroups = filterItems(prcGroups.map((item) => ({
    value: item.value,
    label: item.value,
    meta: `${item.rowCount.toLocaleString()}건`,
  })), queries.prcGroup)
  const filteredEqps = filterItems(eqps.length ? [
    {
      value: ALL_EQPS,
      label: "ALL",
      meta: `${eqps.reduce((total, item) => total + item.rowCount, 0).toLocaleString()}건`,
    },
    ...eqps.map((item) => ({
      value: item.value,
      label: stripPngExtension(item.value),
      meta: `${item.rowCount.toLocaleString()}건`,
    })),
  ] : [], queries.eqp)
  const filteredSensors = filterItems(sensors.map((item) => ({
    value: item.value,
    label: item.value,
    meta: `${item.rowCount.toLocaleString()}건`,
  })), queries.sensor)

  return (
    <div ref={pageRef} className="relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-muted/30">
      <header className="shrink-0 border-b bg-card px-6 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">공통부 이상감지</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Line Name, SDWT, prc_group, eqp, sensor를 선택해 공통부 이상감지 결과를 조회합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm font-medium text-foreground" aria-live="polite">
              {currentUserQuery.data?.knoxId
                ? `${currentUserQuery.data.knoxId}님 안녕하세요!`
                : currentUserQuery.isLoading
                ? "접속자 확인 중…"
                : "접속자 정보를 확인할 수 없습니다."}
            </p>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/"><ArrowLeft className="size-4" aria-hidden="true" />SPIDER 메인</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="shrink-0 border-b bg-card">
        <div className="overflow-x-auto px-6 py-2">
          <div className="grid h-[320px] min-w-[1120px] grid-cols-5 gap-4">
            <FilterCard
              title="Line Name"
              badge={lines.length || null}
              disabled={mappingQuery.isLoading || !lines.length}
              placeholder={mappingQuery.isLoading ? "로딩 중…" : "선택 가능한 Line이 없습니다."}
              isActive={Boolean(activeLine)}
              isLoading={mappingQuery.isFetching}
              query={queries.line}
              onQueryChange={(value) => setQuery("line", value)}
            >
              {filteredLines.map((item) => (
                <SelectRow key={item.value} label={item.label} selected={activeLine === item.value} onClick={() => {
                  setSelectedLine(item.value)
                  setSelectedTeam("")
                  setQueries((current) => ({ ...current, team: "" }))
                  resetAfterTeam()
                }} />
              ))}
            </FilterCard>
            <FilterCard
              title="SDWT"
              badge={teamOptions.length || null}
              disabled={!activeLine}
              placeholder="Line Name을 먼저 선택하세요"
              isActive={Boolean(activeTeam)}
              query={queries.team}
              onQueryChange={(value) => setQuery("team", value)}
            >
              {filteredTeams.map((item) => (
                <SelectRow key={item.value} label={item.label} selected={activeTeam === item.value} onClick={() => {
                  setSelectedTeam(item.value)
                  resetAfterTeam()
                }} />
              ))}
            </FilterCard>
            <FilterCard
              title="prc_group"
              badge={prcGroups.length || null}
              disabled={!activeTeam || dataQuery.isLoading}
              placeholder={dataQuery.isLoading ? "로딩 중…" : "선택 조건에 해당하는 prc_group이 없습니다."}
              isActive={Boolean(activePrcGroup)}
              isLoading={dataQuery.isFetching && !selectedPrcGroup}
              query={queries.prcGroup}
              onQueryChange={(value) => setQuery("prcGroup", value)}
            >
              {filteredPrcGroups.map((item) => (
                <SelectRow key={item.value} label={item.label} meta={item.meta} selected={activePrcGroup === item.value} onClick={() => {
                  setSelectedPrcGroup((current) => current === item.value ? "" : item.value)
                  setSelectedEqp("")
                  setSelectedSensor("")
                  setQuery("eqp", "")
                  setQuery("sensor", "")
                }} />
              ))}
            </FilterCard>
            <FilterCard
              title="eqp"
              badge={eqps.length || null}
              disabled={!selectedPrcGroup || dataQuery.isLoading}
              placeholder={selectedPrcGroup ? "선택 prc_group에 해당하는 eqp가 없습니다." : "prc_group을 먼저 선택하세요"}
              isActive={Boolean(activeEqp)}
              isLoading={dataQuery.isFetching && Boolean(selectedPrcGroup) && !selectedEqp}
              query={queries.eqp}
              onQueryChange={(value) => setQuery("eqp", value)}
            >
              {filteredEqps.map((item) => (
                <SelectRow key={item.value} label={item.label} meta={item.meta} selected={activeEqp === item.value} onClick={() => {
                  setSelectedEqp((current) => current === item.value ? "" : item.value)
                  setSelectedSensor("")
                  setQuery("sensor", "")
                }} />
              ))}
            </FilterCard>
            <FilterCard
              title="sensor"
              badge={sensors.length || null}
              disabled={!selectedEqp || dataQuery.isLoading}
              placeholder={selectedEqp ? "선택 eqp에 해당하는 sensor가 없습니다." : "eqp를 먼저 선택하세요"}
              isActive={Boolean(activeSensor)}
              isLoading={dataQuery.isFetching && Boolean(selectedEqp)}
              query={queries.sensor}
              onQueryChange={(value) => setQuery("sensor", value)}
            >
              {filteredSensors.map((item) => (
                <SelectRow key={item.value} label={item.label} meta={item.meta} selected={activeSensor === item.value} onClick={() => {
                  setSelectedSensor((current) => current === item.value ? "" : item.value)
                }} />
              ))}
            </FilterCard>
          </div>
        </div>
        {mappingQuery.isError ? <p className="border-t px-6 py-2 text-xs text-destructive">{mappingQuery.error.message}</p> : null}
      </section>

      <main className="grid min-w-0 gap-4 p-4">
        {dataQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dataQuery.error.message}
          </div>
        ) : null}
        <section className="grid min-w-0 gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Scatter chart</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                sensor를 선택하면 공통부 data.parquet의 act_time과 선택 sensor 값을 표시합니다.
              </p>
            </div>
            {sensorIsSelected ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{chartGroups.length.toLocaleString()} EQP categories</Badge>
                <Badge variant="outline">{chartRows.length.toLocaleString()} charts</Badge>
              </div>
            ) : null}
          </div>
          {!sensorIsSelected ? (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              prc_group, eqp와 sensor를 선택하면 scatter chart가 표시됩니다.
            </div>
          ) : chartGroups.length ? (
            <div className="grid min-w-0 gap-5">
              {chartGroups.map((group) => (
                <section key={group.eqp} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
                  <header className="flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2"><Badge>EQP</Badge><h3 className="truncate text-sm font-semibold">{group.eqp}</h3></div>
                    <Badge variant="secondary">{group.rows.length.toLocaleString()} charts</Badge>
                  </header>
                  <div className="grid min-w-0 grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
                    {group.rows.map((row) => <CommonScatterCard key={row.id} row={row} />)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card text-sm text-muted-foreground">
              {dataQuery.isLoading ? "데이터를 불러오는 중입니다." : "표시할 file_path 데이터가 없습니다."}
            </div>
          )}
        </section>
      </main>

      <Button type="button" size="icon" className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg" aria-label="화면 맨 위로 이동" onClick={() => pageRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
        <ArrowUp className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
