import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowUp, Check, ChevronRight, Loader2 } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

import { createClickedCategoryHistory } from "../api/clickedCategoryHistoryApi"
import { ResizableFilterArea } from "../components/ResizableFilterArea"
import { fetchCurrentUser } from "../api/currentUserApi"
import { createHitHistory } from "../api/hitHistoryApi"
import { fetchLineMapping } from "../api/mappingConfigApi"
import { fetchMyEqpRegistrations } from "../api/myEqpRegistrationApi"
import {
  createPassHistory,
  createPassHistoryBatch,
  deletePassHistory,
  fetchPassHistory,
  fetchSkipListData,
} from "../api/passHistoryApi"
import {
  fetchErdIdentityData,
  fetchErdScatterData,
  fetchMyEqpEquipmentData,
  fetchSelfEquipmentData,
} from "../api/selfEquipmentApi"
import { SENSOR_GRADES, SPIDER_LINE_REV } from "../utils/fdcTrendMockData"
import { getLowestChStepRowsByPpid } from "../utils/chStepGrouping.mjs"
import { formatLineDisplayName } from "../utils/lineDisplay.mjs"
import {
  MY_EQP_TEAM_KEY,
  MY_EQP_TEAM_LABEL,
  readSelfEquipmentUrlFilters,
  resolveSelfEquipmentGrades,
  resolveSelfEquipmentTeam,
} from "../utils/selfEquipmentUrlFilters.mjs"
import {
  buildIdentityChartPoints,
  samplePoints,
  selectRenderedIdentityPoints,
} from "../utils/identityChart.mjs"

const EMPTY_MAPPING = Object.freeze({})
const EMPTY_LIST = Object.freeze([])
const ALL_EQP_CHANNELS = "ALL"
const ALL_SENSORS = "ALL"
const ALL_CH_STEPS = "ALL"
const SKIP_LIST_TEAM = "__SKIP_LIST__"
const SKIP_LIST_LABEL = "SKIP LIST"
const MY_EQP_TEAM = MY_EQP_TEAM_KEY
const MY_EQP_LABEL = MY_EQP_TEAM_LABEL
const SCATTER_CHART_MARGIN = Object.freeze({ top: 42, right: 18, bottom: 28, left: 16 })
const SCATTER_Y_AXIS_WIDTH = 64
const SCATTER_X_AXIS_HEIGHT = 30
const EMPTY_EQP_SET = new Set()

function expandPriorities(grades) {
  return Array.from(new Set(
    grades.flatMap((grade) => (grade === "A/B" ? ["A", "B"] : [grade])),
  ))
}

function SelectRow({ label, meta, selected, multiple = false, onClick }) {
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
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-medium leading-5 text-foreground",
          selected && "text-primary",
        )}
        title={label}
      >
        {label}
      </span>
      {meta ? (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{meta}</span>
      ) : null}
      {multiple ? (
        <Check className={cn("size-3 shrink-0", selected ? "text-primary" : "text-transparent")} />
      ) : (
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
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
  scrollPositionRef,
  children,
}) {
  const contentRef = useRef(null)
  const localScrollPositionRef = useRef(0)
  const activeScrollPositionRef = scrollPositionRef ?? localScrollPositionRef
  const isRestoringScrollRef = useRef(false)

  useLayoutEffect(() => {
    if (!contentRef.current) return undefined

    const content = contentRef.current
    const savedScrollTop = activeScrollPositionRef.current
    isRestoringScrollRef.current = true
    content.scrollTop = savedScrollTop
    const animationFrame = requestAnimationFrame(() => {
      content.scrollTop = savedScrollTop
      isRestoringScrollRef.current = false
    })

    return () => cancelAnimationFrame(animationFrame)
  })

  return (
    <Card
      className={cn(
        "grid min-h-0 min-w-0 grid-rows-[48px_40px_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl border bg-card py-0 shadow-sm transition-all",
        isActive && "ring-2 ring-primary/50",
      )}
    >
      <div
        className={cn(
          "flex h-12 items-center border-b px-4",
          isActive ? "bg-primary/10" : "bg-muted/40",
        )}
      >
        <div className="flex h-full min-w-0 flex-1 items-center justify-between gap-2">
          <CardTitle
            className={cn(
              "truncate text-sm font-semibold leading-5",
              disabled && "text-muted-foreground",
              isActive && "text-primary",
            )}
          >
            {title}
          </CardTitle>
          {isLoading ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="로딩 중" />
          ) : badge != null ? (
            <Badge variant={isActive ? "default" : "secondary"} className="shrink-0 text-[11px]">
              {badge}
            </Badge>
          ) : null}
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
      <CardContent
        ref={contentRef}
        className="min-h-0 overflow-y-auto overflow-x-hidden bg-background/60 p-2"
        onScroll={(event) => {
          if (!isRestoringScrollRef.current) {
            activeScrollPositionRef.current = event.currentTarget.scrollTop
          }
        }}
      >
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

function getLatestDateFromErdPath(filePath) {
  const normalizedPath = String(filePath ?? "").replaceAll("/pic_server2/", "/pic/")
  return normalizedPath.match(/\/erd\/([^/]+)\//)?.[1] ?? ""
}

function normalizePassHistoryDate(value) {
  const text = String(value ?? "")
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/)
  if (!match) return text
  return !match[2] || match[2] === "00:00:00" ? match[1] : `${match[1]} ${match[2]}`
}

function buildChartPassHistoryKey(lineId, row) {
  return [
    lineId,
    row.ver,
    row.sdwt,
    row.desc,
    row.recipe_id,
    normalizePassHistoryDate(getLatestDateFromErdPath(row.file_path)),
    row.priority,
    row.sensor,
    row.step,
    stripPngExtension(row.eqp),
  ].map((value) => String(value ?? "")).join("\u0000")
}

function buildRecordPassHistoryKey(record) {
  return [
    record.line_id,
    record.ver,
    record.sdwt,
    record.desc,
    record.recipe_id,
    normalizePassHistoryDate(record.update_date),
    record.priority,
    record.sensor,
    record.step,
    stripPngExtension(record.eqp),
  ].map((value) => String(value ?? "")).join("\u0000")
}

function formatActTimeTick(value) {
  if (Number.isFinite(Number(value))) {
    return new Date(Number(value)).toISOString().slice(0, 10).replaceAll("-", "/")
  }
  const text = String(value ?? "")
  return text.slice(0, 10).replaceAll("-", "/")
}

function safeHistoryUrl(value) {
  const url = String(value ?? "").trim()
  return /^(https?:\/\/|\/)/i.test(url) ? url : ""
}

function numericDomain(values, fallbackPadding) {
  let minimum = Infinity
  let maximum = -Infinity
  values.forEach((value) => {
    if (!Number.isFinite(value)) return
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  })
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return [0, 1]
  if (minimum !== maximum) {
    const padding = (maximum - minimum) * 0.025
    return [minimum - padding, maximum + padding]
  }

  const padding = Math.abs(minimum) * 0.05 || fallbackPadding
  return [minimum - padding, maximum + padding]
}

function drawZoomOverlay(element, start, end) {
  if (!element || !start || !end) return

  const left = Math.min(start.pixelX, end.pixelX)
  const top = Math.min(start.pixelY, end.pixelY)
  element.style.display = "block"
  element.style.width = `${Math.abs(end.pixelX - start.pixelX)}px`
  element.style.height = `${Math.abs(end.pixelY - start.pixelY)}px`
  element.style.transform = `translate3d(${left}px, ${top}px, 0)`
}

function hideZoomOverlay(element) {
  if (element) element.style.display = "none"
}

function ChangeHistoryLabel({ viewBox, history }) {
  if (!viewBox || !history) return null

  const label = history.workType || "변경점"
  const details = [history.date, history.description, history.ctttmUrl].filter(Boolean).join(" · ")
  const url = safeHistoryUrl(history.ctttmUrl)
  const text = (
    <text
      x={viewBox.x}
      y={Math.max(viewBox.y - 8, 12)}
      fill="#15803d"
      fontSize="10"
      fontWeight="600"
      textAnchor="middle"
    >
      <title>{details}</title>
      {label}
    </text>
  )

  return url ? (
    <a href={url} target="_blank" rel="noreferrer">{text}</a>
  ) : text
}

function ScatterPointTooltip({ active, payload, axisColumn, lotIdLabel = "root_lot_id" }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  const rows = [
    ...(point.eqpCb ? [["eqp_cb", point.eqpCb]] : []),
    ["eqp_id", point.eqpId],
    ["disp_name", point.dispName],
    ["wafer_id", point.waferId],
    [lotIdLabel, point.rootLotId],
    [axisColumn, Number(point.value).toFixed(2)],
    ["act_time", point.actTime],
  ]

  return (
    <div className="grid min-w-52 gap-1.5 rounded-md border bg-background p-3 text-xs shadow-md">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <span className="text-muted-foreground">{label}</span>
          <span className="break-all text-right font-mono text-foreground">
            {value === "" || value === null || value === undefined ? "-" : value}
          </span>
        </div>
      ))}
    </div>
  )
}

function IdentityScatterPoint({ cx, cy, payload }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !payload) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={payload.isSelected ? "#ef4444" : "#9ca3af"}
      stroke="none"
    />
  )
}

function IdentityXAxisTick({ x, y, payload, groups }) {
  const index = Math.floor(Number(payload?.value))
  const group = groups[index]
  if (!group) return null

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-8}
        y={0}
        transform="rotate(-90)"
        fill={group.isSelected ? "#dc2626" : "var(--muted-foreground)"}
        fontSize="11"
        fontWeight={group.isSelected ? "700" : "500"}
        textAnchor="end"
        dominantBaseline="middle"
      >
        {group.eqpCb}
      </text>
    </g>
  )
}

export function IdentityChartDialog({
  row,
  eqp,
  identityFetcher = fetchErdIdentityData,
  queryKeyPrefix = "erd-identity-data",
  lotIdLabel = "root_lot_id",
}) {
  const chartRef = useRef(null)
  const zoomOverlayRef = useRef(null)
  const zoomSelectionRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [zoomDomain, setZoomDomain] = useState(null)
  const [referenceLineMode, setReferenceLineMode] = useState(false)
  const [referenceLines, setReferenceLines] = useState([])
  const identityQuery = useQuery({
    queryKey: [queryKeyPrefix, row.file_path, eqp, row.sensor, row.step],
    queryFn: ({ signal }) => identityFetcher({
      filePath: row.file_path,
      eqp,
      sensor: row.sensor,
      chStep: row.step,
      signal,
    }),
    enabled: Boolean(open && row.file_path && eqp && row.sensor && row.step),
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const groups = identityQuery.data?.groups ?? EMPTY_LIST
  const axisColumn = identityQuery.data?.axisColumn ?? `${row.sensor}_${row.step}`
  const sharedYDomain = useMemo(
    () => numericDomain(
      groups.flatMap((group) => group.points.map((point) => point.value)),
      1,
    ),
    [groups],
  )
  const identityPoints = useMemo(() => buildIdentityChartPoints(groups), [groups])
  const renderedIdentitySeries = useMemo(
    () => selectRenderedIdentityPoints(groups, identityPoints, zoomDomain),
    [groups, identityPoints, zoomDomain],
  )
  const fullXDomain = [0, Math.max(groups.length, 1)]
  const xTicks = groups.map((_, index) => index + 0.5)
  const identityXAxisHeight = Math.min(
    150,
    Math.max(68, groups.reduce((length, group) => Math.max(length, group.eqpCb.length), 0) * 7 + 18),
  )
  const identityMargin = { top: 18, right: 14, bottom: 8, left: 8 }

  const updateZoomSelection = (selection) => {
    zoomSelectionRef.current = selection
    if (!selection) hideZoomOverlay(zoomOverlayRef.current)
  }
  const getZoomPoint = (event) => {
    const chart = chartRef.current
    if (!chart || !event) return null

    const bounds = chart.getBoundingClientRect()
    const plotLeft = identityMargin.left + SCATTER_Y_AXIS_WIDTH
    const plotRight = bounds.width - identityMargin.right
    const plotTop = identityMargin.top
    const plotBottom = bounds.height - identityMargin.bottom - identityXAxisHeight
    const chartX = Math.min(Math.max(event.clientX - bounds.left, plotLeft), plotRight)
    const chartY = Math.min(Math.max(event.clientY - bounds.top, plotTop), plotBottom)
    const xDomain = zoomDomain?.x ?? fullXDomain
    const yDomain = zoomDomain?.y ?? sharedYDomain
    const xRatio = (chartX - plotLeft) / Math.max(plotRight - plotLeft, 1)
    const yRatio = (chartY - plotTop) / Math.max(plotBottom - plotTop, 1)

    return {
      x: xDomain[0] + xRatio * (xDomain[1] - xDomain[0]),
      y: yDomain[1] - yRatio * (yDomain[1] - yDomain[0]),
      pixelX: chartX,
      pixelY: chartY,
    }
  }
  const handleZoomStart = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const point = getZoomPoint(event)
    if (!point) return
    if (referenceLineMode) {
      const nextLines = [...referenceLines.slice(0, 1), point.y]
      setReferenceLines(nextLines)
      if (nextLines.length === 2) setReferenceLineMode(false)
      return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateZoomSelection(point)
    drawZoomOverlay(zoomOverlayRef.current, point, point)
  }
  const handleZoomMove = (event) => {
    const start = zoomSelectionRef.current
    if (!start) return
    const point = getZoomPoint(event)
    if (point) drawZoomOverlay(zoomOverlayRef.current, start, point)
  }
  const handleZoomEnd = (event) => {
    const start = zoomSelectionRef.current
    if (!start) return
    const point = getZoomPoint(event)
    if (point && Math.abs(point.pixelX - start.pixelX) > 4 && Math.abs(point.pixelY - start.pixelY) > 4) {
      setZoomDomain({
        x: [Math.min(start.x, point.x), Math.max(start.x, point.x)],
        y: [Math.min(start.y, point.y), Math.max(start.y, point.y)],
      })
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    updateZoomSelection(null)
  }
  const resetZoom = () => {
    updateZoomSelection(null)
    setZoomDomain(null)
  }
  const handleReferenceLineMode = () => {
    setReferenceLineMode((current) => {
      if (current) return false
      if (referenceLines.length >= 2) setReferenceLines([])
      return true
    })
  }
  const clearReferenceLines = () => {
    setReferenceLineMode(false)
    setReferenceLines([])
  }
  const handleChartContextMenu = (event) => {
    event.preventDefault()
    clearReferenceLines()
  }
  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetZoom()
      clearReferenceLines()
    }
  }
  const visibleXDomain = zoomDomain?.x ?? fullXDomain
  const referenceBand = referenceLines.length === 2
    ? [Math.min(...referenceLines), Math.max(...referenceLines)]
    : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 px-[0.9rem] text-sm">동일성 차트</Button>
      </DialogTrigger>
      <DialogContent className="h-[88vh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-[96vw]">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle>{eqp || "EQP 미지정"} 동일성 차트</DialogTitle>
            <Button
              type="button"
              size="sm"
              variant={referenceLineMode ? "default" : "outline"}
              onClick={handleReferenceLineMode}
            >
              기준선 긋기
            </Button>
          </div>
          <DialogDescription className="grid gap-1">
            <span className="font-medium text-foreground">
              {row.recipe_id || "PPID 미지정"} / {row.sensor || "sensor 미지정"} / {row.step || "ch_step 미지정"}
            </span>
            <span>
              {identityQuery.data
                ? `${identityQuery.data.groupCount.toLocaleString()}개 EQP · ${identityQuery.data.pointCount.toLocaleString()} points`
                : "동일한 데이터 파일의 전체 eqp_cb를 비교합니다."}
            </span>
          </DialogDescription>
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            마우스 오버: 상세정보 · 좌클릭 드래그: 영역 확대 · 더블클릭: 확대 초기화 ·
            기준선 긋기 후 좌클릭 2회: 기준 구간 표시 · 우클릭: 기준선 삭제
          </p>
        </DialogHeader>
        {identityQuery.isLoading ? (
          <div className="grid min-h-80 place-items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              동일성 차트 데이터를 불러오는 중입니다.
            </span>
          </div>
        ) : identityQuery.isError ? (
          <div className="grid min-h-80 place-items-center px-6 text-center text-sm text-destructive">
            {identityQuery.error.message}
          </div>
        ) : groups.length ? (
          <div
            ref={chartRef}
            className="relative min-h-0 w-full cursor-crosshair select-none touch-none rounded-md border bg-background"
            onPointerDown={handleZoomStart}
            onPointerMove={handleZoomMove}
            onPointerUp={handleZoomEnd}
            onPointerCancel={() => updateZoomSelection(null)}
            onDoubleClick={resetZoom}
            onContextMenu={handleChartContextMenu}
          >
            <div
              ref={zoomOverlayRef}
              className="pointer-events-none absolute left-0 top-0 z-10 hidden border border-primary bg-primary/10 will-change-transform"
              aria-hidden="true"
            />
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={identityMargin}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="identityX"
                  type="number"
                  height={identityXAxisHeight}
                  domain={zoomDomain?.x ?? fullXDomain}
                  allowDataOverflow={Boolean(zoomDomain)}
                  ticks={xTicks}
                  tick={<IdentityXAxisTick groups={groups} />}
                  interval={0}
                />
                <YAxis
                  dataKey="value"
                  type="number"
                  name={axisColumn}
                  width={SCATTER_Y_AXIS_WIDTH}
                  domain={zoomDomain?.y ?? sharedYDomain}
                  allowDataOverflow={Boolean(zoomDomain)}
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                />
                <RechartsTooltip
                  content={<ScatterPointTooltip axisColumn={axisColumn} lotIdLabel={lotIdLabel} />}
                  cursor={false}
                  isAnimationActive={false}
                  animationDuration={0}
                  wrapperStyle={{ transition: "none", willChange: "auto" }}
                />
                {referenceBand ? (
                  <ReferenceArea
                    x1={visibleXDomain[0]}
                    x2={visibleXDomain[1]}
                    y1={referenceBand[0]}
                    y2={referenceBand[1]}
                    fill="#fb923c"
                    fillOpacity={0.16}
                    stroke="none"
                    ifOverflow="visible"
                  />
                ) : null}
                {referenceLines.map((value, index) => (
                  <ReferenceLine
                    key={`user-reference-${index}`}
                    y={value}
                    stroke="#f97316"
                    strokeWidth={1.75}
                    ifOverflow="extendDomain"
                  />
                ))}
                {groups.slice(1).map((group, index) => (
                  <ReferenceLine
                    key={group.eqpCb}
                    x={index + 1}
                    stroke="var(--foreground)"
                    strokeWidth={1.25}
                  />
                ))}
                <Scatter
                  data={renderedIdentitySeries.points}
                  dataKey="value"
                  shape={<IdentityScatterPoint />}
                  fill="#9ca3af"
                  stroke="none"
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center text-sm text-muted-foreground">
            표시할 eqp_cb 데이터가 없습니다.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const ThreeDayIdentityChartCard = memo(function ThreeDayIdentityChartCard({ row, eqp }) {
  const cardRef = useRef(null)
  const [isNearViewport, setIsNearViewport] = useState(false)

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
    }, { rootMargin: "500px 0px" })
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  const identityQuery = useQuery({
    queryKey: ["erd-identity-data", row.file_path, eqp, row.sensor, row.step, 3],
    queryFn: ({ signal }) => fetchErdIdentityData({
      filePath: row.file_path,
      eqp,
      sensor: row.sensor,
      chStep: row.step,
      days: 3,
      signal,
    }),
    enabled: Boolean(isNearViewport && row.file_path && eqp && row.sensor && row.step),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  })
  const groups = identityQuery.data?.groups ?? EMPTY_LIST
  const axisColumn = identityQuery.data?.axisColumn ?? `${row.sensor}_${row.step}`
  const identityPoints = useMemo(() => buildIdentityChartPoints(groups), [groups])
  const renderedPoints = useMemo(
    () => selectRenderedIdentityPoints(groups, identityPoints, null).points,
    [groups, identityPoints],
  )
  const yDomain = useMemo(
    () => numericDomain(groups.flatMap((group) => group.points.map((point) => point.value)), 1),
    [groups],
  )
  const xDomain = [0, Math.max(groups.length, 1)]
  const xTicks = groups.map((_, index) => index + 0.5)
  const xAxisHeight = Math.min(
    120,
    Math.max(62, groups.reduce((length, group) => Math.max(length, group.eqpCb.length), 0) * 6 + 16),
  )

  return (
    <article ref={cardRef} className="grid min-h-[400px] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-primary/25 bg-card shadow-sm">
      <header className="border-b border-primary/20 bg-primary/5 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">최근 3일 동일성 차트</h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.recipe_id || "PPID 미지정"} · {row.sensor || "sensor 미지정"} · {row.step || "ch_step 미지정"}
            </p>
          </div>
          {identityQuery.data ? (
            <Badge variant="secondary" className="shrink-0">
              {groups.length.toLocaleString()} EQP · {identityQuery.data.pointCount.toLocaleString()} points
            </Badge>
          ) : null}
        </div>
      </header>
      <div className="grid min-h-[320px] place-items-center bg-background p-3">
        {!isNearViewport || identityQuery.isLoading ? (
          <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            최근 3일 동일성 데이터를 준비 중입니다.
          </div>
        ) : identityQuery.isError ? (
          <div className="max-w-md px-4 text-center text-sm text-destructive">
            {identityQuery.error.message}
          </div>
        ) : groups.length ? (
          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 18, right: 14, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="identityX"
                  type="number"
                  height={xAxisHeight}
                  domain={xDomain}
                  ticks={xTicks}
                  tick={<IdentityXAxisTick groups={groups} />}
                  interval={0}
                />
                <YAxis
                  dataKey="value"
                  type="number"
                  name={axisColumn}
                  width={SCATTER_Y_AXIS_WIDTH}
                  domain={yDomain}
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => Number(value).toFixed(2)}
                />
                <RechartsTooltip
                  content={<ScatterPointTooltip axisColumn={axisColumn} />}
                  cursor={false}
                  isAnimationActive={false}
                  animationDuration={0}
                  wrapperStyle={{ transition: "none", willChange: "auto" }}
                />
                {groups.slice(1).map((group, index) => (
                  <ReferenceLine
                    key={group.eqpCb}
                    x={index + 1}
                    stroke="var(--foreground)"
                    strokeWidth={1.25}
                  />
                ))}
                <Scatter
                  data={renderedPoints}
                  dataKey="value"
                  shape={<IdentityScatterPoint />}
                  fill="#9ca3af"
                  stroke="none"
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="px-4 text-center text-sm text-muted-foreground">
            최근 3일 범위에 표시할 동일성 데이터가 없습니다.
          </div>
        )}
      </div>
    </article>
  )
})

export const SkipChartDialog = memo(function SkipChartDialog({
  eqp,
  filePath,
  lineId,
  disabled,
  prcGroup = "",
  dataQueryKeyPrefix = "self-equipment-data",
}) {
  const queryClient = useQueryClient()
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [skipComment, setSkipComment] = useState("")
  const [skipClickedAt, setSkipClickedAt] = useState("")

  const refreshPassHistory = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pass-history", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["skip-list-data", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["common-anomaly-skip-list", lineId] }),
    queryClient.invalidateQueries({ queryKey: [dataQueryKeyPrefix, lineId] }),
  ])
  const createSkipMutation = useMutation({
    mutationFn: createPassHistory,
    onSuccess: async () => {
      setSkipDialogOpen(false)
      setSkipComment("")
      setSkipClickedAt("")
      await refreshPassHistory()
      toast.success("SKIP완료")
    },
    onError: (error) => toast.error(error.message),
  })
  const handleSkipDialogChange = (nextOpen) => {
    if (createSkipMutation.isPending) return
    setSkipDialogOpen(nextOpen)
    if (nextOpen) {
      setSkipClickedAt(new Date().toISOString())
      return
    }
    setSkipComment("")
    setSkipClickedAt("")
  }

  const handleSkipConfirm = () => {
    createSkipMutation.mutate({
      lineId,
      filePath,
      eqp,
      prcGroup,
      comment: skipComment,
      execDate: skipClickedAt || new Date().toISOString(),
    })
  }

  return (
    <Dialog open={skipDialogOpen} onOpenChange={handleSkipDialogChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>SKIP</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{eqp || "EQP 미지정"} 이상감지 SKIP</DialogTitle>
          <DialogDescription>
            SKIP 사유를 한 줄로 입력할 수 있습니다. comment는 입력하지 않아도 됩니다.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={skipComment}
          onChange={(event) => setSkipComment(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && !createSkipMutation.isPending) {
              event.preventDefault()
              handleSkipConfirm()
            }
          }}
          placeholder="comment 입력 (선택)"
          aria-label="SKIP comment"
          autoFocus
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSkipDialogChange(false)}
            disabled={createSkipMutation.isPending}
          >
            취소
          </Button>
          <Button type="button" onClick={handleSkipConfirm} disabled={createSkipMutation.isPending}>
            {createSkipMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export const EqpAllSkipDialog = memo(function EqpAllSkipDialog({
  eqp,
  lineId,
  loadTargets,
  dataQueryKeyPrefix,
  disabled = false,
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState("")
  const [clickedAt, setClickedAt] = useState("")
  const refreshPassHistory = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pass-history", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["skip-list-data", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["common-anomaly-skip-list", lineId] }),
    queryClient.invalidateQueries({ queryKey: [dataQueryKeyPrefix, lineId] }),
  ])
  const createAllSkipMutation = useMutation({
    mutationFn: async () => {
      const targets = await loadTargets()
      const uniqueTargets = Array.from(new Map(targets.map((target) => [
        [target.filePath, target.eqp, target.prcGroup].join("\u0000"),
        { lineId, ...target },
      ])).values())
      if (!uniqueTargets.length) throw new Error("일괄 SKIP할 ch_step 데이터가 없습니다.")
      return createPassHistoryBatch({
        records: uniqueTargets,
        comment,
        execDate: clickedAt || new Date().toISOString(),
      })
    },
    onSuccess: async (result) => {
      setOpen(false)
      setComment("")
      setClickedAt("")
      await refreshPassHistory()
      toast.success(`EQP ALL SKIP 완료 (${result.requestedRows?.toLocaleString() ?? 0}건)`)
    },
    onError: (error) => toast.error(error.message),
  })
  const handleOpenChange = (nextOpen) => {
    if (createAllSkipMutation.isPending) return
    setOpen(nextOpen)
    if (nextOpen) {
      setClickedAt(new Date().toISOString())
      return
    }
    setComment("")
    setClickedAt("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          EQP ALL SKIP
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{eqp || "EQP 미지정"} ALL SKIP</DialogTitle>
          <DialogDescription>
            이 EQP의 실제 모든 ch_step을 각각 PASS 이력에 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="comment 입력 (선택)"
          aria-label="EQP ALL SKIP comment"
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createAllSkipMutation.isPending}>
            취소
          </Button>
          <Button type="button" onClick={() => createAllSkipMutation.mutate()} disabled={createAllSkipMutation.isPending}>
            {createAllSkipMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

const ErdScatterCard = memo(function ErdScatterCard({ row, lineId, passRecord, allSkipLoadTargets }) {
  const eqp = stripPngExtension(row.eqp)
  const queryClient = useQueryClient()
  const cardRef = useRef(null)
  const chartContainerRef = useRef(null)
  const zoomOverlayRef = useRef(null)
  const zoomSelectionRef = useRef(null)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [zoomDomain, setZoomDomain] = useState(null)
  const isSkipped = Boolean(passRecord)

  const refreshPassHistory = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pass-history", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["skip-list-data", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["self-equipment-data", lineId] }),
  ])
  const deleteSkipMutation = useMutation({
    mutationFn: deletePassHistory,
    onSuccess: async () => {
      await refreshPassHistory()
      toast.success("SKIP해제 완료")
    },
    onError: (error) => toast.error(error.message),
  })
  const handleSkipDelete = () => {
    deleteSkipMutation.mutate({ lineId, filePath: row.file_path })
  }
  const saveHitHistoryMutation = useMutation({
    mutationFn: createHitHistory,
    onSuccess: () => toast.success("이력저장 완료"),
    onError: (error) => toast.error(error.message),
  })
  const handleHistorySave = () => {
    saveHitHistoryMutation.mutate({
      lineId,
      filePath: row.file_path,
      execDate: new Date().toISOString(),
    })
  }

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
    queryKey: ["erd-scatter-data", row.file_path, eqp, row.sensor, row.step],
    queryFn: () => fetchErdScatterData({
      filePath: row.file_path,
      eqp,
      sensor: row.sensor,
      chStep: row.step,
    }),
    enabled: Boolean(isNearViewport && row.file_path && eqp && row.sensor && row.step),
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const points = chartQuery.data?.points ?? EMPTY_LIST
  const changeHistory = chartQuery.data?.changeHistory ?? EMPTY_LIST
  const renderedPointSeries = useMemo(() => {
    const visiblePoints = zoomDomain
      ? points.filter((point) => (
        point.actTimeMs >= zoomDomain.x[0]
        && point.actTimeMs <= zoomDomain.x[1]
        && point.value >= zoomDomain.y[0]
        && point.value <= zoomDomain.y[1]
      ))
      : points

    return {
      recent: samplePoints(visiblePoints.filter((point) => point.isRecent)),
      previous: samplePoints(visiblePoints.filter((point) => !point.isRecent)),
    }
  }, [points, zoomDomain])
  const axisColumn = chartQuery.data?.axisColumn ?? `${row.sensor}_${row.step}`
  const baseDomain = useMemo(() => ({
    x: numericDomain([
      ...points.map((point) => point.actTimeMs),
      ...changeHistory.map((history) => history.dateMs),
    ], 60 * 60 * 1000),
    y: numericDomain(points.map((point) => point.value), 1),
  }), [changeHistory, points])

  const getZoomPoint = (event) => {
    const chart = chartContainerRef.current
    if (!chart || !event) return null

    const bounds = chart.getBoundingClientRect()
    const plotLeft = SCATTER_CHART_MARGIN.left + SCATTER_Y_AXIS_WIDTH
    const plotRight = bounds.width - SCATTER_CHART_MARGIN.right
    const plotTop = SCATTER_CHART_MARGIN.top
    const plotBottom = bounds.height - SCATTER_CHART_MARGIN.bottom - SCATTER_X_AXIS_HEIGHT
    const chartX = Math.min(Math.max(event.clientX - bounds.left, plotLeft), plotRight)
    const chartY = Math.min(Math.max(event.clientY - bounds.top, plotTop), plotBottom)
    const xDomain = zoomDomain?.x ?? baseDomain.x
    const yDomain = zoomDomain?.y ?? baseDomain.y
    const xRatio = (chartX - plotLeft) / Math.max(plotRight - plotLeft, 1)
    const yRatio = (chartY - plotTop) / Math.max(plotBottom - plotTop, 1)

    return {
      x: xDomain[0] + xRatio * (xDomain[1] - xDomain[0]),
      y: yDomain[1] - yRatio * (yDomain[1] - yDomain[0]),
      pixelX: chartX,
      pixelY: chartY,
    }
  }
  const updateZoomSelection = (selection) => {
    zoomSelectionRef.current = selection
    if (!selection) hideZoomOverlay(zoomOverlayRef.current)
  }
  const handleZoomStart = (event) => {
    if (event?.button !== 0) return
    event.preventDefault()
    const point = getZoomPoint(event)
    if (!point) return

    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateZoomSelection(point)
    drawZoomOverlay(zoomOverlayRef.current, point, point)
  }
  const handleZoomMove = (event) => {
    const start = zoomSelectionRef.current
    if (!start) return
    const point = getZoomPoint(event)
    if (point) drawZoomOverlay(zoomOverlayRef.current, start, point)
  }
  const handleZoomEnd = (event) => {
    const start = zoomSelectionRef.current
    if (!start) return

    const point = getZoomPoint(event)
    if (point && Math.abs(point.pixelX - start.pixelX) > 4 && Math.abs(point.pixelY - start.pixelY) > 4) {
      setZoomDomain({
        x: [Math.min(start.x, point.x), Math.max(start.x, point.x)],
        y: [Math.min(start.y, point.y), Math.max(start.y, point.y)],
      })
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    updateZoomSelection(null)
  }
  const resetZoom = () => {
    updateZoomSelection(null)
    setZoomDomain(null)
  }

  return (
    <article ref={cardRef} className="grid min-h-[400px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card shadow-sm">
      <header className="border-b bg-muted/50 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className="shrink-0 text-sm font-semibold">{eqp || "EQP 미지정"}</h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.recipe_id || "PPID 미지정"} · {row.sensor || "sensor 미지정"} · {row.step || "ch_step 미지정"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSkipped ? <Badge variant="destructive">이상감지 SKIP 건</Badge> : null}
            {chartQuery.data ? (
              <Badge variant="secondary">{points.length.toLocaleString()} 매</Badge>
            ) : null}
            <Badge variant="outline">{row.priority ? `${row.priority}등급` : "등급 미지정"}</Badge>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500" /> 이상감지 data
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-gray-400" /> 이전 데이터
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-green-600" /> 변경점 이력
          </span>
          <span>드래그 확대 · 더블클릭 원복</span>
        </div>
      </header>
      <div className="grid min-h-[320px] place-items-center bg-background p-3">
        {!isNearViewport ? (
          <div className="text-sm text-muted-foreground">화면에 표시할 차트를 준비 중입니다.</div>
        ) : chartQuery.isLoading ? (
          <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ERD 이상감지 데이터를 불러오는 중입니다.
          </div>
        ) : chartQuery.isError ? (
          <div className="max-w-md px-4 text-center text-sm text-destructive">
            {chartQuery.error.message}
          </div>
        ) : points.length ? (
          <div
            ref={chartContainerRef}
            className="relative h-[320px] w-full min-w-0 cursor-crosshair select-none touch-none"
            onPointerDown={handleZoomStart}
            onPointerMove={handleZoomMove}
            onPointerUp={handleZoomEnd}
            onPointerCancel={() => updateZoomSelection(null)}
            onDoubleClick={resetZoom}
          >
            <div
              ref={zoomOverlayRef}
              className="pointer-events-none absolute left-0 top-0 z-10 hidden border border-primary bg-primary/10 will-change-transform"
              aria-hidden="true"
            />
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={SCATTER_CHART_MARGIN}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="actTimeMs"
                  type="number"
                  name="act_time"
                  height={SCATTER_X_AXIS_HEIGHT}
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
                  width={SCATTER_Y_AXIS_WIDTH}
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
                  wrapperStyle={{ transition: "none", willChange: "auto" }}
                />
                {changeHistory.map((history, index) => (
                  <ReferenceLine
                    key={`${history.dateMs}-${index}`}
                    x={history.dateMs}
                    stroke="#16a34a"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    ifOverflow="extendDomain"
                    label={<ChangeHistoryLabel history={history} />}
                  />
                ))}
                <Scatter
                  data={renderedPointSeries.previous}
                  dataKey="value"
                  fill="#9ca3af"
                  isAnimationActive={false}
                />
                <Scatter
                  data={renderedPointSeries.recent}
                  dataKey="value"
                  fill="#ef4444"
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="px-4 text-center text-sm text-muted-foreground">
            {eqp}에 해당하는 유효한 scatter 데이터가 없습니다.
          </div>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SkipChartDialog
            eqp={eqp}
            filePath={row.file_path}
            lineId={lineId}
            disabled={isSkipped}
          />
          {allSkipLoadTargets ? (
            <EqpAllSkipDialog
              eqp={eqp}
              lineId={lineId}
              dataQueryKeyPrefix="self-equipment-data"
              loadTargets={allSkipLoadTargets}
            />
          ) : null}
          {isSkipped ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSkipDelete}
              disabled={deleteSkipMutation.isPending}
            >
              {deleteSkipMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              SKIP해제
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <IdentityChartDialog row={row} eqp={eqp} />
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 px-[0.9rem] text-sm">변경점이력</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{eqp || "EQP 미지정"} 변경점 이력</DialogTitle>
              <DialogDescription>
                총 {changeHistory.length.toLocaleString()}건의 변경점 이력입니다.
              </DialogDescription>
            </DialogHeader>
            {chartQuery.isLoading ? (
              <div className="grid min-h-32 place-items-center rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  변경점 이력을 불러오는 중입니다.
                </span>
              </div>
            ) : changeHistory.length ? (
              <div className="max-h-[65vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>date</TableHead>
                      <TableHead>work_type</TableHead>
                      <TableHead>desc</TableHead>
                      <TableHead className="w-20 text-center">LINK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeHistory.map((history, index) => {
                      const historyUrl = safeHistoryUrl(history.ctttmUrl)
                      return (
                        <TableRow key={`${history.dateMs}-${index}`}>
                          <TableCell className="font-mono text-xs">{history.date || "-"}</TableCell>
                          <TableCell>{history.workType || "-"}</TableCell>
                          <TableCell className="min-w-64 whitespace-normal break-words">
                            {history.description || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {historyUrl ? (
                              <Button type="button" variant="outline" size="sm" asChild>
                                <a href={historyUrl} target="_blank" rel="noreferrer">LINK</a>
                              </Button>
                            ) : (
                              <Button type="button" variant="outline" size="sm" disabled>LINK</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid min-h-32 place-items-center rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
                {chartQuery.data?.historyError || "표시할 변경점 이력이 없습니다."}
              </div>
            )}
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-[0.9rem] text-sm"
            onClick={handleHistorySave}
            disabled={saveHitHistoryMutation.isPending}
          >
            {saveHitHistoryMutation.isPending
              ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              : null}
            이력저장
          </Button>
        </div>
      </footer>
    </article>
  )
})

export function FdcTrendPage() {
  const pageRef = useRef(null)
  const stepScrollPositionRef = useRef(0)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const requestedFilters = useMemo(
    () => readSelfEquipmentUrlFilters(searchParams),
    [searchParams],
  )
  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
    retry: false,
  })
  const [selectedLine, setSelectedLine] = useState(() => requestedFilters.line)
  const [selectedTeam, setSelectedTeam] = useState(() => requestedFilters.sdwts[0] ?? "")
  const [selectedGrades, setSelectedGrades] = useState(() => (
    resolveSelfEquipmentGrades(requestedFilters.grades, SENSOR_GRADES).length
      ? resolveSelfEquipmentGrades(requestedFilters.grades, SENSOR_GRADES)
      : ["A/B"]
  ))
  const [selectedDesc, setSelectedDesc] = useState("")
  const [selectedEqpCh, setSelectedEqpCh] = useState("")
  const [selectedSensor, setSelectedSensor] = useState("")
  const [selectedChStep, setSelectedChStep] = useState("")
  const [showThreeDayIdentity, setShowThreeDayIdentity] = useState(true)
  const [expandedChSteps, setExpandedChSteps] = useState({
    contextKey: "",
    eqps: EMPTY_EQP_SET,
    lastEqp: "",
  })
  const [queries, setQueries] = useState({
    line: "",
    team: "",
    grade: "",
    step: "",
    eqpCh: "",
    sensor: "",
    chStep: "",
  })
  const mappingQuery = useQuery({
    queryKey: ["l0-spider-line-mapping"],
    queryFn: fetchLineMapping,
  })
  const lineMapping = mappingQuery.data?.line_mapping ?? SPIDER_LINE_REV
  const sdwtMapping = mappingQuery.data?.sdwt_mapping ?? EMPTY_MAPPING
  const lines = useMemo(
    () => Array.from(new Set(Object.values(lineMapping))),
    [lineMapping],
  )
  const activeLine = lines.includes(selectedLine) ? selectedLine : (lines[0] ?? "")
  const myEqpRegistrationsQuery = useQuery({
    queryKey: ["my-eqp-registrations", activeLine, true],
    queryFn: () => fetchMyEqpRegistrations({ line: activeLine, activeOnly: true }),
    enabled: Boolean(activeLine),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: false,
  })
  const hasActiveMyEqp = Boolean(myEqpRegistrationsQuery.data?.length)
  const teamOptions = useMemo(
    () => [
      ...Object.entries(lineMapping)
        .filter(([, line]) => line === activeLine)
        .map(([key]) => ({ key, label: sdwtMapping[key] ?? key })),
      ...(hasActiveMyEqp ? [{ key: MY_EQP_TEAM, label: MY_EQP_LABEL }] : []),
      ...(activeLine ? [{ key: SKIP_LIST_TEAM, label: SKIP_LIST_LABEL }] : []),
    ],
    [activeLine, hasActiveMyEqp, lineMapping, sdwtMapping],
  )
  const resolvedSelectedTeam = resolveSelfEquipmentTeam(teamOptions, [selectedTeam])
  const activeTeam = resolvedSelectedTeam
    ? resolvedSelectedTeam
    : (teamOptions[0]?.key ?? "")
  const activeTeamLabel = teamOptions.find((team) => team.key === activeTeam)?.label ?? ""
  const isSkipList = activeTeam === SKIP_LIST_TEAM
  const isMyEqp = activeTeam === MY_EQP_TEAM
  const priorities = useMemo(() => expandPriorities(selectedGrades), [selectedGrades])
  const dataQueryKey = [
    isSkipList ? "skip-list-data" : isMyEqp ? "my-eqp-equipment-data" : "self-equipment-data",
    activeLine,
    activeTeam,
    activeTeamLabel,
    priorities,
    selectedDesc,
    selectedEqpCh,
    selectedSensor,
    selectedChStep,
  ]
  const dataQuery = useQuery({
    queryKey: dataQueryKey,
    queryFn: () => isSkipList
      ? fetchSkipListData({
          lineId: activeLine,
          priorities,
          desc: selectedDesc,
          eqpCh: selectedEqpCh,
          sensor: selectedSensor,
          chStep: selectedChStep,
        })
      : isMyEqp
      ? fetchMyEqpEquipmentData({
          line: activeLine,
          priorities,
          desc: selectedDesc,
          eqpCh: selectedEqpCh,
          sensor: selectedSensor,
          chStep: selectedChStep,
        })
      : fetchSelfEquipmentData({
          line: activeLine,
          pathSdwt: activeTeam,
          sdwt: activeTeamLabel,
          priorities,
          desc: selectedDesc,
          eqpCh: selectedEqpCh,
          sensor: selectedSensor,
          chStep: selectedChStep,
        }),
    enabled: Boolean(
      activeLine
      && activeTeam
      && activeTeamLabel
    ),
    placeholderData: (previousData, previousQuery) => {
      const previousKey = previousQuery?.queryKey ?? []
      const sameFiltersExceptChStep = JSON.stringify(previousKey.slice(0, -1))
        === JSON.stringify(dataQueryKey.slice(0, -1))
      return sameFiltersExceptChStep ? previousData : undefined
    },
  })
  const steps = dataQuery.data?.steps ?? []
  const eqpChannels = dataQuery.data?.eqpChannels ?? []
  const sensors = dataQuery.data?.sensors ?? []
  const chSteps = dataQuery.data?.chSteps ?? []
  const activeDesc = dataQuery.data?.filters?.desc ?? ""
  const activeEqpCh = dataQuery.data?.filters?.eqpCh ?? ""
  const activeSensor = dataQuery.data?.filters?.sensor ?? ""
  const activeChStep = dataQuery.data?.filters?.chStep ?? ""
  const gatherContextKey = [
    activeLine,
    activeTeam,
    activeDesc,
    activeEqpCh,
    activeSensor,
    activeChStep,
  ].join("\u0000")
  const expandedEqps = expandedChSteps.contextKey === gatherContextKey
    ? expandedChSteps.eqps
    : EMPTY_EQP_SET
  const passHistoryQuery = useQuery({
    queryKey: ["pass-history", activeLine, activeTeamLabel, activeDesc],
    queryFn: () => fetchPassHistory({
      lineId: activeLine,
      sdwt: activeTeamLabel,
      desc: activeDesc,
    }),
    enabled: Boolean(
      !isSkipList
      && !isMyEqp
      && activeLine
      && activeTeamLabel
      && activeDesc
    ),
    staleTime: 30 * 1000,
    retry: false,
  })
  const passHistoryByKey = useMemo(() => new Map(
    (passHistoryQuery.data?.records ?? EMPTY_LIST).map((record) => [
      buildRecordPassHistoryKey(record),
      record,
    ]),
  ), [passHistoryQuery.data?.records])
  const chStepIsSelected = Boolean(selectedChStep && activeChStep === selectedChStep)
  const dataRows = dataQuery.data?.rows
  const chartRows = useMemo(() => {
    if (!chStepIsSelected) return []
    return dataRows ?? []
  }, [chStepIsSelected, dataRows])
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
  const visibleChartGroups = useMemo(() => chartGroups.map((group) => {
    const gathered = !expandedEqps.has(group.eqp)
    const visibleRows = gathered ? getLowestChStepRowsByPpid(group.rows) : group.rows
    return {
      ...group,
      gathered,
      visibleRows,
      visibleRowIds: new Set(visibleRows.map((row) => row.id)),
      animate: expandedChSteps.contextKey === gatherContextKey
        && expandedChSteps.lastEqp === group.eqp,
    }
  }), [chartGroups, expandedChSteps.contextKey, expandedChSteps.lastEqp, expandedEqps, gatherContextKey])
  const allSkipLoadTargetsByEqp = useMemo(() => {
    if (isSkipList) return new Map()
    return new Map(chartGroups.map((group) => [group.eqp, async () => {
      const payload = await fetchSelfEquipmentData({
        line: activeLine,
        pathSdwt: activeTeam,
        sdwt: activeTeamLabel,
        priorities,
        desc: activeDesc,
        eqpCh: group.rows[0]?.eqp ?? group.eqp,
        sensor: activeSensor,
        chStep: ALL_CH_STEPS,
      })
      return (payload.rows ?? []).map((targetRow) => ({ filePath: targetRow.file_path }))
    }]))
  }, [activeDesc, activeLine, activeSensor, activeTeam, activeTeamLabel, chartGroups, isSkipList, priorities])

  const filteredLines = filterItems(
    lines.map((line) => ({ value: line, label: formatLineDisplayName(line) })),
    queries.line,
  )
  const filteredTeams = filterItems(
    teamOptions.map((team) => ({ value: team.key, label: team.label })),
    queries.team,
  )
  const gradeOptions = useMemo(() => {
    if (!isSkipList && !isMyEqp) return SENSOR_GRADES
    return Array.from(new Set(
      (dataQuery.data?.availablePriorities ?? EMPTY_LIST)
        .map((priority) => (["A", "B"].includes(priority) ? "A/B" : priority)),
    )).filter((grade) => SENSOR_GRADES.includes(grade))
  }, [dataQuery.data?.availablePriorities, isMyEqp, isSkipList])
  const filteredGrades = filterItems(
    gradeOptions.map((grade) => ({ value: grade, label: grade })),
    queries.grade,
  )
  const filteredSteps = filterItems(
    steps.map((item) => ({
      value: item.desc,
      label: item.desc,
      meta: `${item.rowCount.toLocaleString()}건 · ${item.equipmentCount.toLocaleString()} eqp`,
    })),
    queries.step,
  )
  const filteredEqpChannels = filterItems(
    eqpChannels.length ? [
      {
        value: ALL_EQP_CHANNELS,
        label: "ALL",
        meta: `${eqpChannels.reduce((total, item) => total + item.rowCount, 0).toLocaleString()}건`,
      },
      ...eqpChannels.map((item) => ({
        value: item.eqpCh,
        label: stripPngExtension(item.eqpCh),
        meta: `${item.rowCount.toLocaleString()}건`,
      })),
    ] : [],
    queries.eqpCh,
  )
  const filteredSensors = filterItems(
    sensors.length ? [
      ...(selectedEqpCh === ALL_EQP_CHANNELS ? [] : [{
        value: ALL_SENSORS,
        label: "ALL",
        meta: `${sensors.reduce((total, item) => total + item.rowCount, 0).toLocaleString()}건`,
      }]),
      ...sensors.map((item) => ({
        value: item.sensor,
        label: item.sensor,
        meta: `${item.rowCount.toLocaleString()}건`,
      })),
    ] : [],
    queries.sensor,
  )
  const filteredChSteps = filterItems(
    chSteps.length ? [
      {
        value: ALL_CH_STEPS,
        label: "ALL",
        meta: `${chSteps.reduce((total, item) => total + item.rowCount, 0).toLocaleString()}건`,
      },
      ...chSteps.map((item) => ({
        value: item.step,
        label: item.step.split("@")[0],
        meta: `${item.rowCount.toLocaleString()}건 · ${item.equipmentCount.toLocaleString()} eqp`,
      })),
    ] : [],
    queries.chStep,
  )

  const setQuery = (key, value) => setQueries((current) => ({ ...current, [key]: value }))
  const resetStepAndSensor = () => {
    setSelectedDesc("")
    setSelectedEqpCh("")
    setSelectedSensor("")
    setSelectedChStep("")
    setQueries((current) => ({ ...current, step: "", eqpCh: "", sensor: "", chStep: "" }))
  }
  const handleLineChange = (line) => {
    setSelectedLine(line)
    setSelectedTeam("")
    if (activeTeam === MY_EQP_TEAM) setSelectedGrades(["A/B"])
    setQueries((current) => ({ ...current, team: "", step: "", eqpCh: "", sensor: "", chStep: "" }))
    resetStepAndSensor()
  }
  const handleTeamChange = (team) => {
    setSelectedTeam(team)
    if (team === MY_EQP_TEAM) {
      setSelectedGrades([...SENSOR_GRADES])
    } else if (activeTeam === MY_EQP_TEAM) {
      setSelectedGrades(["A/B"])
    }
    resetStepAndSensor()
  }
  const toggleGrade = (grade) => {
    setSelectedGrades((current) => (
      current.includes(grade)
        ? current.filter((item) => item !== grade)
        : gradeOptions.filter((item) => [...current, grade].includes(item))
    ))
    resetStepAndSensor()
  }
  const handleChStepChange = async (chStep) => {
    const nextChStep = selectedChStep === chStep ? "" : chStep
    const clickedAt = new Date().toISOString()
    setSelectedChStep(nextChStep)
    if (!nextChStep || isSkipList) return

    try {
      const queryKey = [
        isMyEqp ? "my-eqp-equipment-data" : "self-equipment-data",
        activeLine,
        activeTeam,
        activeTeamLabel,
        priorities,
        selectedDesc,
        selectedEqpCh,
        selectedSensor,
        nextChStep,
      ]
      const payload = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => isMyEqp
          ? fetchMyEqpEquipmentData({
              line: activeLine,
              priorities,
              desc: selectedDesc,
              eqpCh: selectedEqpCh,
              sensor: selectedSensor,
              chStep: nextChStep,
            })
          : fetchSelfEquipmentData({
              line: activeLine,
              pathSdwt: activeTeam,
              sdwt: activeTeamLabel,
              priorities,
              desc: selectedDesc,
              eqpCh: selectedEqpCh,
              sensor: selectedSensor,
              chStep: nextChStep,
            }),
      })
      const filePaths = (payload.rows ?? []).map((row) => row.file_path)
      if (!filePaths.length) return
      await createClickedCategoryHistory({
        app: "self",
        lineId: activeLine,
        filePaths,
        grades: priorities,
        clickedAt,
      })
    } catch (error) {
      toast.error(`클릭이력 저장 실패: ${error.message}`)
    }
  }
  const toggleGatheredChSteps = (eqp) => {
    setExpandedChSteps((current) => {
      const nextEqps = new Set(current.contextKey === gatherContextKey ? current.eqps : EMPTY_EQP_SET)
      if (nextEqps.has(eqp)) nextEqps.delete(eqp)
      else nextEqps.add(eqp)
      return { contextKey: gatherContextKey, eqps: nextEqps, lastEqp: eqp }
    })
  }

  return (
    <div ref={pageRef} className="relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-muted/30">
      <header className="shrink-0 border-b bg-card px-6 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">자설비 이상감지</h1>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              라인, 분임조, 센서 등급과 STEP, eqp_ch, sensor, ch_step을 선택해 ERD 결과를 조회합니다.
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
              <Link to="/">
                <ArrowLeft className="size-4" aria-hidden="true" />
                SPIDER 메인
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="shrink-0 border-b bg-card px-6 py-3">
        <div className="flex justify-start">
          <button
            type="button"
            className="group inline-flex items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="switch"
            aria-checked={showThreeDayIdentity}
            onClick={() => setShowThreeDayIdentity((current) => !current)}
          >
            <span className={cn(
              "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ease-in-out",
              showThreeDayIdentity
                ? "border-primary bg-primary"
                : "border-input bg-muted-foreground/35",
            )}>
              <span className={cn(
                "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out",
                showThreeDayIdentity && "translate-x-5",
              )} />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">3일치 동일성 차트 같이 보기</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                ch_step 모아보기에서 기존 차트 오른쪽에 최근 72시간 동일성 차트를 표시합니다.
              </span>
            </span>
            <span className="sr-only">{showThreeDayIdentity ? "켜짐" : "꺼짐"}</span>
          </button>
        </div>
      </section>

      <section className="shrink-0 border-b bg-card">
        <ResizableFilterArea defaultHeight={332} minHeight={160} maxHeight={720}>
          <div className="h-full overflow-x-auto px-6 py-2">
            <div className="grid h-full min-w-[1640px] grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,1.45fr)_minmax(0,1.15fr)_minmax(0,1.2fr)_minmax(0,1.05fr)] gap-4">
            <FilterCard
              title="Line Name"
              badge={lines.length ? `${lines.length}` : null}
              disabled={lines.length === 0}
              placeholder="선택 가능한 Line이 없습니다."
              isActive={Boolean(activeLine)}
              isLoading={mappingQuery.isFetching && lines.length === 0}
              query={queries.line}
              onQueryChange={(value) => setQuery("line", value)}
            >
              {filteredLines.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  selected={activeLine === item.value}
                  onClick={() => handleLineChange(item.value)}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="SDWT"
              badge={teamOptions.length ? `${teamOptions.length}` : null}
              disabled={!activeLine}
              placeholder="Line Name을 먼저 선택하세요"
              isActive={Boolean(activeTeam)}
              query={queries.team}
              onQueryChange={(value) => setQuery("team", value)}
            >
              {filteredTeams.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  selected={activeTeam === item.value}
                  onClick={() => handleTeamChange(item.value)}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="Sensor Grade"
              badge={`${gradeOptions.length}`}
              disabled={!activeTeam}
              placeholder={!activeTeam
                ? "SDWT를 먼저 선택하세요"
                : dataQuery.isLoading
                ? "로딩 중…"
                : isSkipList
                ? "SKIP된 차트가 없습니다."
                : "선택 가능한 Sensor Grade가 없습니다."}
              isActive={selectedGrades.length > 0}
              query={queries.grade}
              onQueryChange={(value) => setQuery("grade", value)}
            >
              {filteredGrades.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  selected={selectedGrades.includes(item.value)}
                  multiple
                  onClick={() => toggleGrade(item.value)}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="STEP"
              badge={steps.length ? `${steps.length}` : null}
              disabled={!activeTeam || dataQuery.isLoading}
              placeholder={dataQuery.isLoading ? "로딩 중…" : "선택 조건에 해당하는 STEP이 없습니다."}
              isActive={Boolean(activeDesc)}
              isLoading={dataQuery.isFetching && !selectedDesc}
              query={queries.step}
              onQueryChange={(value) => setQuery("step", value)}
              scrollPositionRef={stepScrollPositionRef}
            >
              {filteredSteps.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  meta={item.meta}
                  selected={activeDesc === item.value}
                  onClick={() => {
                    setSelectedDesc((current) => current === item.value ? "" : item.value)
                    setSelectedEqpCh("")
                    setSelectedSensor("")
                    setSelectedChStep("")
                    setQuery("eqpCh", "")
                    setQuery("sensor", "")
                    setQuery("chStep", "")
                  }}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="eqp_ch"
              badge={eqpChannels.length ? `${eqpChannels.length}` : null}
              disabled={!selectedDesc || dataQuery.isLoading}
              placeholder={selectedDesc ? "선택 STEP에 해당하는 eqp_ch가 없습니다." : "STEP을 먼저 선택하세요"}
              isActive={Boolean(activeEqpCh)}
              isLoading={dataQuery.isFetching && Boolean(selectedDesc) && !selectedEqpCh}
              query={queries.eqpCh}
              onQueryChange={(value) => setQuery("eqpCh", value)}
            >
              {filteredEqpChannels.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  meta={item.meta}
                  selected={activeEqpCh === item.value}
                  onClick={() => {
                    setSelectedEqpCh((current) => current === item.value ? "" : item.value)
                    setSelectedSensor("")
                    setSelectedChStep("")
                    setQuery("sensor", "")
                    setQuery("chStep", "")
                  }}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="sensor"
              badge={sensors.length ? `${sensors.length}` : null}
              disabled={!selectedEqpCh || dataQuery.isLoading}
              placeholder={selectedEqpCh ? "선택 eqp_ch에 해당하는 sensor가 없습니다." : "eqp_ch를 먼저 선택하세요"}
              isActive={Boolean(activeSensor)}
              isLoading={dataQuery.isFetching && Boolean(selectedEqpCh)}
              query={queries.sensor}
              onQueryChange={(value) => setQuery("sensor", value)}
            >
              {filteredSensors.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  meta={item.meta}
                  selected={activeSensor === item.value}
                  onClick={() => {
                    setSelectedSensor((current) => current === item.value ? "" : item.value)
                    setSelectedChStep("")
                    setQuery("chStep", "")
                  }}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="ch_step"
              badge={chSteps.length ? `${chSteps.length}` : null}
              disabled={!selectedSensor || dataQuery.isLoading}
              placeholder={selectedSensor ? "선택 sensor에 해당하는 ch_step이 없습니다." : "sensor를 먼저 선택하세요"}
              isActive={Boolean(activeChStep)}
              isLoading={dataQuery.isFetching && Boolean(selectedSensor)}
              query={queries.chStep}
              onQueryChange={(value) => setQuery("chStep", value)}
            >
              {filteredChSteps.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  meta={item.meta}
                  selected={activeChStep === item.value}
                  onClick={() => { void handleChStepChange(item.value) }}
                />
              ))}
            </FilterCard>
            </div>
          </div>
        </ResizableFilterArea>
        {mappingQuery.isError ? (
          <p className="border-t px-6 py-2 text-xs text-destructive">{mappingQuery.error.message}</p>
        ) : null}
        {myEqpRegistrationsQuery.isError ? (
          <p className="border-t px-6 py-2 text-xs text-destructive">
            My EQP 등록 조건을 불러오지 못했습니다: {myEqpRegistrationsQuery.error.message}
          </p>
        ) : null}
      </section>

      <main className="grid min-w-0 gap-4 p-4">
        {dataQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dataQuery.error.message}
          </div>
        ) : null}
        {isMyEqp
          && !dataQuery.isLoading
          && (dataQuery.data?.counts?.registeredEqps ?? 0) > 0
          && (dataQuery.data?.counts?.matchedRegistrationRows ?? 0) === 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            등록된 SDWT·EQP와 일치하는 자설비 이상건을 찾지 못했습니다.
            원본 이상건 {(dataQuery.data?.counts?.sourceRows ?? 0).toLocaleString()}건에서 매칭 결과가 없습니다.
          </div>
        ) : null}
        {!isSkipList && passHistoryQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            PASS 이력을 불러오지 못했습니다: {passHistoryQuery.error.message}
          </div>
        ) : null}

        <section className="grid min-w-0 gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Scatter chart</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ch_step을 선택하면 최신 ERD 이상감지 데이터의 act_time과 sensor_ch_step 값을 표시합니다.
              </p>
            </div>
            {chStepIsSelected ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{chartGroups.length.toLocaleString()} EQP categories</Badge>
                <Badge variant="outline">{chartRows.length.toLocaleString()} charts</Badge>
              </div>
            ) : null}
          </div>
          {!chStepIsSelected ? (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              STEP, eqp_ch, sensor와 ch_step을 선택하면 scatter chart가 표시됩니다.
            </div>
          ) : chartGroups.length ? (
            <div className="grid min-w-0 gap-5">
              {visibleChartGroups.map((group) => (
                <section key={group.eqp} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
                  <header className="flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge>EQP</Badge>
                      <h3 className="truncate text-sm font-semibold">{group.eqp}</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2.5 text-xs"
                        aria-pressed={group.gathered}
                        onClick={() => toggleGatheredChSteps(group.eqp)}
                      >
                        {group.gathered ? "ch_step 전체보기" : "ch_step 모아보기"}
                      </Button>
                    </div>
                    <Badge variant="secondary">
                      {group.visibleRows.length.toLocaleString()}
                      {group.gathered ? ` / ${group.rows.length.toLocaleString()}` : ""} charts
                    </Badge>
                  </header>
                  <div
                    className={cn(
                      "grid min-w-0 grid-cols-1 gap-4 p-4 lg:grid-cols-2",
                      !group.gathered && "xl:grid-cols-3",
                      group.animate && (group.gathered ? "animate-ch-step-gather" : "animate-ch-step-expand"),
                    )}
                  >
                    {group.rows.map((row) => {
                      const isVisible = group.visibleRowIds.has(row.id)
                      return (
                        <Fragment key={row.id}>
                          <div className={cn("min-w-0", !isVisible && "hidden")} aria-hidden={!isVisible}>
                            <ErdScatterCard
                              row={row}
                              lineId={activeLine}
                              passRecord={isSkipList
                                ? row.pass_history
                                : passHistoryByKey.get(buildChartPassHistoryKey(activeLine, row))}
                              allSkipLoadTargets={allSkipLoadTargetsByEqp.get(group.eqp) ?? null}
                            />
                          </div>
                          {isVisible && group.gathered && showThreeDayIdentity ? (
                            <ThreeDayIdentityChartCard row={row} eqp={group.eqp} />
                          ) : null}
                        </Fragment>
                      )
                    })}
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

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg"
        aria-label="화면 맨 위로 이동"
        onClick={() => pageRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

function filterItems(items, query) {
  const normalizedQuery = query.trim().toLowerCase()
  return normalizedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : items
}
