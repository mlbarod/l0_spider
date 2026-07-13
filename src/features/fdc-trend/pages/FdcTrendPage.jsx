import { useMemo, useRef, useState } from "react"
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

import { fetchLineMapping } from "../api/mappingConfigApi"
import { fetchErdScatterData, fetchSelfEquipmentData } from "../api/selfEquipmentApi"
import { SENSOR_GRADES, SPIDER_LINE_REV } from "../utils/fdcTrendMockData"

const EMPTY_MAPPING = Object.freeze({})

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
  children,
}) {
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
  const text = String(value ?? "")
  const time = text.includes(" ") ? text.split(" ").at(-1) : text.split("T").at(-1)
  return time?.slice(0, 8) || text
}

function ScatterPointTooltip({ active, payload, axisColumn }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  const rows = [
    ["eqp_id", point.eqpId],
    ["disp_name", point.dispName],
    ["wafer_id", point.waferId],
    [axisColumn, point.value],
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

function ErdScatterCard({ row }) {
  const eqp = stripPngExtension(row.eqp)
  const chartQuery = useQuery({
    queryKey: ["erd-scatter-data", row.file_path, eqp, row.sensor, row.step],
    queryFn: () => fetchErdScatterData({
      filePath: row.file_path,
      eqp,
      sensor: row.sensor,
      chStep: row.step,
    }),
    enabled: Boolean(row.file_path && eqp && row.sensor && row.step),
    staleTime: 5 * 60 * 1000,
  })
  const points = chartQuery.data?.points ?? []
  const axisColumn = chartQuery.data?.axisColumn ?? `${row.sensor}_${row.step}`
  const chartSourcePath = chartQuery.data?.sourcePath || chartQuery.error?.sourcePath || row.file_path

  return (
    <article className="grid min-h-[400px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card shadow-sm">
      <header className="border-b bg-muted/50 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h3 className="truncate text-sm font-semibold">{eqp || "EQP 미지정"}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {chartQuery.data ? (
              <Badge variant="secondary">{points.length.toLocaleString()} points</Badge>
            ) : null}
            <Badge variant="outline">{row.priority || "-"}</Badge>
          </div>
        </div>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {row.desc} · {axisColumn} · {row.recipe_id}
        </p>
      </header>
      <div className="grid min-h-[320px] place-items-center bg-background p-3">
        {chartQuery.isLoading ? (
          <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ERD 이상감지 데이터를 불러오는 중입니다.
          </div>
        ) : chartQuery.isError ? (
          <div className="max-w-md px-4 text-center text-sm text-destructive">
            {chartQuery.error.message}
          </div>
        ) : points.length ? (
          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 18, bottom: 28, left: 16 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="actTime"
                  type="category"
                  name="act_time"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={formatActTimeTick}
                  label={{ value: "act_time", position: "insideBottom", offset: -18, fontSize: 11 }}
                />
                <YAxis
                  dataKey="value"
                  type="number"
                  name={axisColumn}
                  width={64}
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <RechartsTooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                  content={<ScatterPointTooltip axisColumn={axisColumn} />}
                />
                <Scatter data={points} dataKey="value" fill="var(--chart-1)" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="px-4 text-center text-sm text-muted-foreground">
            {eqp}에 해당하는 유효한 scatter 데이터가 없습니다.
          </div>
        )}
      </div>
      <footer className="border-t px-3 py-2">
        <span className="text-[10px] font-medium text-muted-foreground">Chart draw path</span>
        <p
          className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground"
          title={chartSourcePath}
        >
          {chartSourcePath}
        </p>
      </footer>
    </article>
  )
}

export function FdcTrendPage() {
  const pageRef = useRef(null)
  const [selectedLine, setSelectedLine] = useState("")
  const [selectedTeam, setSelectedTeam] = useState("")
  const [selectedGrades, setSelectedGrades] = useState(() => ["A/B"])
  const [selectedDesc, setSelectedDesc] = useState("")
  const [selectedSensor, setSelectedSensor] = useState("")
  const [selectedChStep, setSelectedChStep] = useState("")
  const [queries, setQueries] = useState({ line: "", team: "", grade: "", step: "", sensor: "", chStep: "" })
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
  const priorities = useMemo(() => expandPriorities(selectedGrades), [selectedGrades])
  const dataQuery = useQuery({
    queryKey: [
      "self-equipment-data",
      activeLine,
      activeTeam,
      activeTeamLabel,
      priorities,
      selectedDesc,
      selectedSensor,
      selectedChStep,
    ],
    queryFn: () => fetchSelfEquipmentData({
      line: activeLine,
      pathSdwt: activeTeam,
      sdwt: activeTeamLabel,
      priorities,
      desc: selectedDesc,
      sensor: selectedSensor,
      chStep: selectedChStep,
    }),
    enabled: Boolean(activeLine && activeTeam && activeTeamLabel),
  })
  const steps = dataQuery.data?.steps ?? []
  const sensors = dataQuery.data?.sensors ?? []
  const chSteps = dataQuery.data?.chSteps ?? []
  const activeDesc = dataQuery.data?.filters?.desc ?? ""
  const activeSensor = dataQuery.data?.filters?.sensor ?? ""
  const activeChStep = dataQuery.data?.filters?.chStep ?? ""
  const chStepIsSelected = Boolean(selectedChStep && activeChStep === selectedChStep)
  const dataRows = dataQuery.data?.rows
  const chartRows = useMemo(
    () => chStepIsSelected ? (dataRows ?? []) : [],
    [chStepIsSelected, dataRows],
  )
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

  const filteredLines = filterItems(lines.map((line) => ({ value: line, label: line })), queries.line)
  const filteredTeams = filterItems(
    teamOptions.map((team) => ({ value: team.key, label: team.label })),
    queries.team,
  )
  const filteredGrades = filterItems(
    SENSOR_GRADES.map((grade) => ({ value: grade, label: grade })),
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
  const filteredSensors = filterItems(
    sensors.map((item) => ({
      value: item.sensor,
      label: item.sensor,
      meta: `${item.rowCount.toLocaleString()}건`,
    })),
    queries.sensor,
  )
  const filteredChSteps = filterItems(
    chSteps.map((item) => ({
      value: item.step,
      label: item.step,
      meta: `${item.rowCount.toLocaleString()}건 · ${item.equipmentCount.toLocaleString()} eqp`,
    })),
    queries.chStep,
  )

  const setQuery = (key, value) => setQueries((current) => ({ ...current, [key]: value }))
  const resetStepAndSensor = () => {
    setSelectedDesc("")
    setSelectedSensor("")
    setSelectedChStep("")
    setQueries((current) => ({ ...current, step: "", sensor: "", chStep: "" }))
  }
  const handleLineChange = (line) => {
    setSelectedLine(line)
    setSelectedTeam("")
    setQueries((current) => ({ ...current, team: "", step: "", sensor: "", chStep: "" }))
    resetStepAndSensor()
  }
  const handleTeamChange = (team) => {
    setSelectedTeam(team)
    resetStepAndSensor()
  }
  const toggleGrade = (grade) => {
    setSelectedGrades((current) => (
      current.includes(grade)
        ? current.filter((item) => item !== grade)
        : SENSOR_GRADES.filter((item) => [...current, grade].includes(item))
    ))
    resetStepAndSensor()
  }

  return (
    <div ref={pageRef} className="relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-muted/30">
      <header className="shrink-0 border-b bg-card px-6 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">자설비 이상감지</h1>
              <Badge variant="outline">Parquet</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              라인, 분임조, 센서 등급과 STEP, sensor, ch_step을 선택해 ERD 결과를 조회합니다.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              SPIDER 메인
            </Link>
          </Button>
        </div>
      </header>

      <section className="shrink-0 border-b bg-card">
        <div className="overflow-x-auto px-6 py-2">
          <div className="grid h-[320px] min-w-[1420px] grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,1.55fr)_minmax(0,1.25fr)_minmax(0,1.15fr)] gap-4">
            <FilterCard
              title="Line Name"
              badge={lines.length ? `${lines.length}` : null}
              disabled={mappingQuery.isLoading || lines.length === 0}
              placeholder={mappingQuery.isLoading ? "로딩 중…" : "선택 가능한 Line이 없습니다."}
              isActive={Boolean(activeLine)}
              isLoading={mappingQuery.isFetching}
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
              badge={`${SENSOR_GRADES.length}`}
              disabled={!activeTeam}
              placeholder="SDWT를 먼저 선택하세요"
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
            >
              {filteredSteps.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  meta={item.meta}
                  selected={activeDesc === item.value}
                  onClick={() => {
                    setSelectedDesc((current) => current === item.value ? "" : item.value)
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
              disabled={!selectedDesc || dataQuery.isLoading}
              placeholder={selectedDesc ? "선택 STEP에 해당하는 sensor가 없습니다." : "STEP을 먼저 선택하세요"}
              isActive={Boolean(activeSensor)}
              isLoading={dataQuery.isFetching && Boolean(selectedDesc)}
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
                  onClick={() => setSelectedChStep((current) => current === item.value ? "" : item.value)}
                />
              ))}
            </FilterCard>
          </div>
        </div>
        {mappingQuery.isError ? (
          <p className="border-t px-6 py-2 text-xs text-destructive">{mappingQuery.error.message}</p>
        ) : null}
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
              STEP, sensor와 ch_step을 선택하면 scatter chart가 표시됩니다.
            </div>
          ) : chartGroups.length ? (
            <div className="grid min-w-0 gap-5">
              {chartGroups.map((group) => (
                <section key={group.eqp} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
                  <header className="flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge>EQP</Badge>
                      <h3 className="truncate text-sm font-semibold">{group.eqp}</h3>
                    </div>
                    <Badge variant="secondary">{group.rows.length.toLocaleString()} charts</Badge>
                  </header>
                  <div className="grid min-w-0 grid-cols-1 gap-4 p-4 xl:grid-cols-2">
                    {group.rows.map((row) => <ErdScatterCard key={row.id} row={row} />)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card text-sm text-muted-foreground">
              {dataQuery.isLoading ? "데이터를 불러오는 중입니다." : "표시할 file_path 데이터가 없습니다."}
            </div>
          )}
          {dataQuery.data?.sourcePath ? (
            <code className="truncate text-[10px] text-muted-foreground">{dataQuery.data.sourcePath}</code>
          ) : null}
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
