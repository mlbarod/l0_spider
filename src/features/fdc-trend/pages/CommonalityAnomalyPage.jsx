import { useMemo, useState } from "react"
import { ArrowLeft, Check, ChevronRight, FileWarning, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { createClickedCategoryHistory } from "../api/clickedCategoryHistoryApi"
import {
  buildCommonalityImageUrl,
  fetchCommonalityData,
} from "../api/commonalityApi"
import { fetchLineMapping } from "../api/mappingConfigApi"
import { SPIDER_LINE_REV } from "../utils/fdcTrendMockData"
import { formatLineDisplayName } from "../utils/lineDisplay.mjs"

const EMPTY_MAPPING = Object.freeze({})
const EMPTY_LIST = Object.freeze([])
const ALL_CH_STEPS = "ALL"

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

function CommonalityImageCard({ row }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = buildCommonalityImageUrl(row.filePath)

  return (
    <article className="grid min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">{row.sensor} / {row.chStep}</h4>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {row.grade} · {row.stepSeq} · {row.ppid}
          </p>
        </div>
        <Badge variant="outline">{row.grade}</Badge>
      </header>
      <div className="grid min-h-[320px] place-items-center bg-muted/10 p-3">
        {imageFailed ? (
          <div className="grid max-w-full justify-items-center gap-3 px-4 text-center">
            <FileWarning className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium text-destructive">이미지를 불러오지 못했습니다.</p>
            <code className="max-w-full break-all rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
              {row.filePath}
            </code>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`${row.stepDesc} ${row.sensor} ${row.chStep} 동일성 이상감지`}
            className="max-h-[520px] w-full object-contain"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
    </article>
  )
}

function filterValues(values, query) {
  const normalizedQuery = query.trim().toLowerCase()
  return normalizedQuery
    ? values.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : values
}

export function CommonalityAnomalyPage() {
  const queryClient = useQueryClient()
  const [selectedLine, setSelectedLine] = useState("")
  const [selectedTeam, setSelectedTeam] = useState("")
  const [selectedSensor, setSelectedSensor] = useState("")
  const [selectedChStep, setSelectedChStep] = useState("")
  const [queries, setQueries] = useState({ line: "", team: "", sensor: "", chStep: "" })
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
  const dataQuery = useQuery({
    queryKey: [
      "commonality-data",
      activeLine,
      activeTeam,
      activeTeamLabel,
      selectedSensor,
      selectedChStep,
    ],
    queryFn: () => fetchCommonalityData({
      line: activeLine,
      pathSdwt: activeTeam,
      sdwt: activeTeamLabel,
      sensor: selectedSensor,
      chStep: selectedChStep,
    }),
    enabled: Boolean(activeLine && activeTeam && activeTeamLabel),
  })
  const sensors = dataQuery.data?.sensors ?? EMPTY_LIST
  const chSteps = dataQuery.data?.chSteps ?? EMPTY_LIST
  const activeSensor = dataQuery.data?.filters?.sensor ?? ""
  const activeChStep = dataQuery.data?.filters?.chStep ?? ""
  const imageRows = selectedChStep && activeChStep === selectedChStep
    ? dataQuery.data?.rows ?? EMPTY_LIST
    : EMPTY_LIST
  const imageGroups = useMemo(() => {
    const groups = new Map()
    imageRows.forEach((row) => {
      const rows = groups.get(row.stepDesc) ?? []
      rows.push(row)
      groups.set(row.stepDesc, rows)
    })
    return Array.from(groups, ([stepDesc, rows]) => ({ stepDesc, rows }))
      .sort((left, right) => left.stepDesc.localeCompare(right.stepDesc, "ko", { numeric: true }))
  }, [imageRows])

  const setQuery = (key, value) => setQueries((current) => ({ ...current, [key]: value }))
  const resetSensorFilters = () => {
    setSelectedSensor("")
    setSelectedChStep("")
    setQueries((current) => ({ ...current, sensor: "", chStep: "" }))
  }
  const handleChStepChange = async (chStep) => {
    const nextChStep = selectedChStep === chStep ? "" : chStep
    const clickedAt = new Date().toISOString()
    setSelectedChStep(nextChStep)
    if (!nextChStep) return

    try {
      const queryKey = [
        "commonality-data",
        activeLine,
        activeTeam,
        activeTeamLabel,
        selectedSensor,
        nextChStep,
      ]
      const payload = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchCommonalityData({
          line: activeLine,
          pathSdwt: activeTeam,
          sdwt: activeTeamLabel,
          sensor: selectedSensor,
          chStep: nextChStep,
        }),
      })
      const filePaths = (payload.rows ?? []).map((row) => row.filePath)
      if (!filePaths.length) return
      await createClickedCategoryHistory({
        app: "commonality",
        lineId: activeLine,
        filePaths,
        clickedAt,
      })
    } catch (error) {
      toast.error(`클릭이력 저장 실패: ${error.message}`)
    }
  }
  const filteredLines = filterValues(
    lines.map((line) => ({ label: formatLineDisplayName(line), value: line })),
    queries.line,
  )
  const filteredTeams = filterValues(teamOptions.map((team) => ({ label: team.label, value: team.key })), queries.team)
  const filteredSensors = filterValues(sensors.map((sensor) => ({ label: sensor, value: sensor })), queries.sensor)
  const filteredChSteps = filterValues(
    chSteps.length
      ? [
          { label: "ALL", value: ALL_CH_STEPS },
          ...chSteps.map((chStep) => ({ label: chStep, value: chStep })),
        ]
      : [],
    queries.chStep,
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-muted/30">
      <header className="shrink-0 border-b bg-card px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">동일성 이상감지</h1>
              <Badge variant="outline">Matching</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              동일성 최신날짜의 그래프를 Line, SDWT, Sensor, ch_step 기준으로 조회합니다.
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
        <div className="overflow-x-auto px-6 py-3">
          <div className="grid h-[300px] min-w-[900px] grid-cols-4 gap-4">
            <FilterCard
              title="Line Name"
              badge={lines.length}
              disabled={mappingQuery.isLoading || !lines.length}
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
                  onClick={() => {
                    setSelectedLine(item.value)
                    setSelectedTeam("")
                    setQueries((current) => ({ ...current, team: "" }))
                    resetSensorFilters()
                  }}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="SDWT"
              badge={teamOptions.length}
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
                  onClick={() => {
                    setSelectedTeam(item.value)
                    resetSensorFilters()
                  }}
                />
              ))}
            </FilterCard>
            <FilterCard
              title="Sensor"
              badge={sensors.length}
              disabled={!activeTeam || dataQuery.isLoading}
              placeholder={dataQuery.isLoading ? "동일성 경로를 탐색하는 중입니다." : "선택 SDWT에 해당하는 Sensor가 없습니다."}
              isActive={Boolean(activeSensor)}
              isLoading={dataQuery.isFetching && !selectedSensor}
              query={queries.sensor}
              onQueryChange={(value) => setQuery("sensor", value)}
            >
              {filteredSensors.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
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
              badge={chSteps.length}
              disabled={!selectedSensor || dataQuery.isLoading}
              placeholder={selectedSensor ? "선택 Sensor에 해당하는 ch_step이 없습니다." : "Sensor를 먼저 선택하세요"}
              isActive={Boolean(activeChStep)}
              isLoading={dataQuery.isFetching && Boolean(selectedSensor)}
              query={queries.chStep}
              onQueryChange={(value) => setQuery("chStep", value)}
            >
              {filteredChSteps.map((item) => (
                <SelectRow
                  key={item.value}
                  label={item.label}
                  selected={activeChStep === item.value}
                  onClick={() => { void handleChStepChange(item.value) }}
                />
              ))}
            </FilterCard>
          </div>
        </div>
      </section>

      <main className="grid min-w-0 gap-4 p-4">
        {dataQuery.data?.latest ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 text-xs">
            <span className="font-semibold">{dataQuery.data.latest.name}</span>
            <code className="text-muted-foreground">{dataQuery.data.latest.date}</code>
          </div>
        ) : null}
        {dataQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dataQuery.error.message}
          </div>
        ) : null}

        <section className="grid min-w-0 gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">동일성 기준 이상감지 그래프</h2>
              <p className="mt-1 text-xs text-muted-foreground">최종 필터 선택 결과를 step_desc 기준으로 분류합니다.</p>
            </div>
            {activeChStep ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{imageGroups.length.toLocaleString()} STEP categories</Badge>
                <Badge variant="outline">{imageRows.length.toLocaleString()} images</Badge>
              </div>
            ) : null}
          </div>

          {!activeChStep ? (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              Line Name, SDWT, Sensor와 ch_step을 선택하면 동일성 그래프가 표시됩니다.
            </div>
          ) : imageGroups.length ? (
            <div className="grid min-w-0 gap-5">
              {imageGroups.map((group) => (
                <section key={group.stepDesc} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
                  <header className="flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge>STEP</Badge>
                      <h3 className="truncate text-sm font-semibold">{group.stepDesc}</h3>
                    </div>
                    <Badge variant="secondary">{group.rows.length.toLocaleString()} images</Badge>
                  </header>
                  <div className="grid min-w-0 grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
                    {group.rows.map((row) => <CommonalityImageCard key={row.id} row={row} />)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card text-sm text-muted-foreground">
              {dataQuery.isFetching ? "이미지 목록을 불러오는 중입니다." : "선택 조건에 해당하는 img.png가 없습니다."}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
