import { useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowUp, ImageOff } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { fetchLineMapping } from "../api/mappingConfigApi"
import { buildErdFileUrl, fetchSelfEquipmentData } from "../api/selfEquipmentApi"
import { SENSOR_GRADES, SPIDER_LINE_REV } from "../utils/fdcTrendMockData"

const MAPPING_TAB_CLASS = "h-8 flex-none px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
const EMPTY_MAPPING = Object.freeze({})

function expandPriorities(grades) {
  return Array.from(new Set(
    grades.flatMap((grade) => (grade === "A/B" ? ["A", "B"] : [grade])),
  ))
}

function SensorGradeButton({ grade, selected, onToggle }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "h-8 rounded-md border px-3 text-xs font-semibold transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground",
      )}
    >
      {grade}
    </button>
  )
}

function StepButton({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border border-transparent px-3 text-left transition hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/30 bg-primary/10 text-primary shadow-sm",
      )}
    >
      <span className="truncate text-[13px] font-medium text-foreground">{item.desc}</span>
      <span className="shrink-0 text-xs font-semibold tabular-nums">{item.rowCount.toLocaleString()}건</span>
      <span className="min-w-14 shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-right text-[11px] font-medium text-muted-foreground">
        {item.equipmentCount.toLocaleString()} eqp
      </span>
    </button>
  )
}

function SensorButton({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 text-left transition hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/30 bg-primary/10 text-primary shadow-sm",
      )}
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{item.sensor}</span>
      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
        {item.rowCount.toLocaleString()}건
      </span>
    </button>
  )
}

function ErdImageCard({ row }) {
  const [imageError, setImageError] = useState(false)

  return (
    <article className="grid min-h-[360px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card shadow-sm">
      <header className="border-b bg-muted/50 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h3 className="truncate text-sm font-semibold">{row.eqp || "EQP 미지정"}</h3>
          <Badge variant="outline" className="shrink-0">{row.priority || "-"}</Badge>
        </div>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {row.desc} · {row.sensor} · {row.recipe_id} · {row.step}
        </p>
      </header>
      <div className="grid min-h-[280px] place-items-center bg-background p-2">
        {imageError ? (
          <div className="grid justify-items-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <ImageOff className="size-7" aria-hidden="true" />
            <span>file_path 이미지를 표시할 수 없습니다.</span>
          </div>
        ) : (
          <img
            src={buildErdFileUrl(row.file_path)}
            alt={`${row.eqp} ${row.sensor} scatter chart`}
            className="max-h-[520px] w-full object-contain"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        )}
      </div>
      <footer className="border-t px-3 py-2">
        <p className="truncate font-mono text-[10px] text-muted-foreground" title={row.file_path}>
          {row.file_path}
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
    ],
    queryFn: () => fetchSelfEquipmentData({
      line: activeLine,
      pathSdwt: activeTeam,
      sdwt: activeTeamLabel,
      priorities,
      desc: selectedDesc,
      sensor: selectedSensor,
    }),
    enabled: Boolean(activeLine && activeTeam && activeTeamLabel),
  })
  const steps = dataQuery.data?.steps ?? []
  const sensors = dataQuery.data?.sensors ?? []
  const chartRows = dataQuery.data?.rows ?? []
  const activeDesc = dataQuery.data?.filters?.desc ?? ""
  const activeSensor = dataQuery.data?.filters?.sensor ?? ""

  const resetDataFilters = () => {
    setSelectedDesc("")
    setSelectedSensor("")
  }
  const handleLineChange = (line) => {
    setSelectedLine(line)
    setSelectedTeam("")
    resetDataFilters()
  }
  const handleTeamChange = (team) => {
    setSelectedTeam(team)
    resetDataFilters()
  }
  const handleToggleGrade = (grade) => {
    setSelectedGrades((current) => (
      current.includes(grade)
        ? current.filter((item) => item !== grade)
        : SENSOR_GRADES.filter((item) => current.includes(item) || item === grade)
    ))
    resetDataFilters()
  }

  return (
    <div ref={pageRef} className="relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-background">
      <header className="shrink-0 border-b bg-card px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">자설비 이상감지</h1>
              <Badge variant="outline">Screening</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              라인, 분임조, 센서 등급을 기준으로 실제 ERD 이상감지 결과를 조회합니다.
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

      <section className="grid shrink-0 gap-3 border-b px-6 py-4">
        <Tabs value={activeLine} onValueChange={handleLineChange}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/70">
            {lines.map((line) => (
              <TabsTrigger key={line} value={line} className={MAPPING_TAB_CLASS}>{line}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={activeTeam} onValueChange={handleTeamChange}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/70">
            {teamOptions.map((team) => (
              <TabsTrigger key={team.key} value={team.key} className={MAPPING_TAB_CLASS}>
                {team.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">센서 등급</span>
          <div className="flex flex-wrap gap-1.5">
            {SENSOR_GRADES.map((grade) => (
              <SensorGradeButton
                key={grade}
                grade={grade}
                selected={selectedGrades.includes(grade)}
                onToggle={() => handleToggleGrade(grade)}
              />
            ))}
          </div>
        </div>
        {mappingQuery.isError ? (
          <p className="text-xs text-destructive">{mappingQuery.error.message}</p>
        ) : null}
      </section>

      <main className="grid min-w-0 gap-5 px-6 py-5">
        {dataQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {dataQuery.error.message}
          </div>
        ) : null}

        <section className="grid h-[480px] w-full max-w-5xl min-w-0 grid-cols-[minmax(320px,420px)_minmax(380px,520px)] gap-4">
          <Card className="grid min-h-0 grid-rows-[48px_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl py-0">
            <div className="flex h-12 items-center justify-between border-b bg-muted/40 px-4">
              <div>
                <CardTitle className="text-sm">STEP 선택</CardTitle>
                <p className="text-[11px] text-muted-foreground">desc별 행 및 설비 수</p>
              </div>
              <Badge variant="secondary">{steps.length} steps</Badge>
            </div>
            <CardContent className="min-h-0 overflow-y-auto bg-background/60 p-2">
              {steps.length ? (
                <div className="grid gap-1.5">
                  {steps.map((item) => (
                    <StepButton
                      key={item.desc}
                      item={item}
                      selected={item.desc === activeDesc}
                      onSelect={() => {
                        setSelectedDesc(item.desc)
                        setSelectedSensor("")
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  {dataQuery.isLoading ? "데이터를 불러오는 중입니다." : "선택 조건에 해당하는 STEP이 없습니다."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="grid min-h-0 grid-rows-[48px_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl py-0">
            <div className="flex h-12 items-center justify-between border-b bg-muted/40 px-4">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{activeDesc || "STEP 미선택"}</CardTitle>
                <p className="text-[11px] text-muted-foreground">sensor별 행 수</p>
              </div>
              <Badge variant="secondary">{sensors.length} sensors</Badge>
            </div>
            <CardContent className="min-h-0 overflow-y-auto bg-background/60 p-2">
              {sensors.length ? (
                <div className="grid gap-1.5">
                  {sensors.map((item) => (
                    <SensorButton
                      key={item.sensor}
                      item={item}
                      selected={item.sensor === activeSensor}
                      onSelect={() => setSelectedSensor(item.sensor)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  STEP을 선택하면 sensor가 표시됩니다.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid min-w-0 gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Scatter chart</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                선택 조건에 해당하는 file_path를 행 단위로 표시합니다.
              </p>
            </div>
            <Badge variant="secondary">{chartRows.length.toLocaleString()} charts</Badge>
          </div>
          {chartRows.length ? (
            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              {chartRows.map((row) => <ErdImageCard key={row.id} row={row} />)}
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
