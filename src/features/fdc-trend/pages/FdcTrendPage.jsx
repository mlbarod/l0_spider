import { useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowUp, ImageOff } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { fetchLineMapping } from "../api/mappingConfigApi"
import { buildErdFileUrl, fetchSelfEquipmentData } from "../api/selfEquipmentApi"
import { SENSOR_GRADES, SPIDER_LINE_REV } from "../utils/fdcTrendMockData"

const EMPTY_MAPPING = Object.freeze({})

function expandPriorities(grades) {
  return Array.from(new Set(
    grades.flatMap((grade) => (grade === "A/B" ? ["A", "B"] : [grade])),
  ))
}

function CheckboxPill({ checked, disabled = false, label, onChange }) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition",
        checked
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-3.5 accent-primary"
      />
      <span>{label}</span>
    </label>
  )
}

function OptionGroup({
  title,
  items,
  selected,
  disabled = false,
  showAll = false,
  onToggle,
  onToggleAll,
}) {
  const allChecked = items.length > 0 && items.every((item) => selected.has(item.value))

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      {showAll ? (
        <>
          <CheckboxPill
            label="All"
            checked={allChecked}
            disabled={disabled || items.length === 0}
            onChange={() => onToggleAll(!allChecked)}
          />
          <div className="h-4 w-px shrink-0 bg-border" />
        </>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {items.length ? items.map((item) => (
          <CheckboxPill
            key={item.value}
            label={item.label}
            checked={selected.has(item.value)}
            disabled={disabled}
            onChange={() => onToggle(item.value)}
          />
        )) : (
          <span className="text-xs text-muted-foreground">선택 가능한 항목이 없습니다.</span>
        )}
      </div>
      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
        {selected.size}/{items.length}
      </span>
    </div>
  )
}

function NativeCheck({ checked, label, meta, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-3.5 accent-primary"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? <span className="shrink-0 text-[10px] text-muted-foreground">{meta}</span> : null}
    </label>
  )
}

function FilterColumn({ title, items, selectedValue, query, onQueryChange, onSelect, emptyText }) {
  const normalizedQuery = query.trim().toLowerCase()
  const visibleItems = normalizedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : items

  return (
    <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] border-r last:border-r-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <h3 className="flex-1 text-xs font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {selectedValue ? 1 : 0}/{items.length}
        </span>
      </div>
      <div className="px-3 pb-2">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search…"
          className="h-8 bg-muted/30 text-xs"
        />
      </div>
      <div className="min-h-0 overflow-y-auto border-t py-1">
        {visibleItems.length ? visibleItems.map((item) => (
          <NativeCheck
            key={item.value}
            label={item.label}
            meta={item.meta}
            checked={selectedValue === item.value}
            onChange={() => onSelect(item.value)}
          />
        )) : (
          <div className="grid min-h-28 place-items-center px-4 text-center text-xs text-muted-foreground">
            {emptyText}
          </div>
        )}
      </div>
    </section>
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
  const [stepQuery, setStepQuery] = useState("")
  const [sensorQuery, setSensorQuery] = useState("")
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
  const activeDesc = dataQuery.data?.filters?.desc ?? ""
  const activeSensor = dataQuery.data?.filters?.sensor ?? ""
  const sensorIsSelected = Boolean(selectedSensor && activeSensor === selectedSensor)
  const chartRows = sensorIsSelected ? (dataQuery.data?.rows ?? []) : []

  const resetStepAndSensor = () => {
    setSelectedDesc("")
    setSelectedSensor("")
    setStepQuery("")
    setSensorQuery("")
  }
  const handleLineChange = (line) => {
    setSelectedLine(line)
    setSelectedTeam("")
    resetStepAndSensor()
  }
  const handleTeamChange = (team) => {
    setSelectedTeam(team)
    resetStepAndSensor()
  }
  const handleGradeChange = (nextGrades) => {
    setSelectedGrades(SENSOR_GRADES.filter((grade) => nextGrades.has(grade)))
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
              라인, 분임조, 센서 등급과 STEP, sensor를 선택해 ERD 결과를 조회합니다.
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
        <div className="grid gap-2 px-6 py-2.5">
          <OptionGroup
            title="Line ID"
            items={lines.map((line) => ({ value: line, label: line }))}
            selected={new Set(activeLine ? [activeLine] : [])}
            onToggle={handleLineChange}
          />
          <OptionGroup
            title="SDWT"
            items={teamOptions.map((team) => ({ value: team.key, label: team.label }))}
            selected={new Set(activeTeam ? [activeTeam] : [])}
            disabled={!activeLine}
            onToggle={handleTeamChange}
          />
          <OptionGroup
            title="Sensor Grade"
            items={SENSOR_GRADES.map((grade) => ({ value: grade, label: grade }))}
            selected={new Set(selectedGrades)}
            showAll
            onToggle={(grade) => {
              const next = new Set(selectedGrades)
              if (next.has(grade)) next.delete(grade)
              else next.add(grade)
              handleGradeChange(next)
            }}
            onToggleAll={(checked) => handleGradeChange(checked ? new Set(SENSOR_GRADES) : new Set())}
          />
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

        <section className="grid h-[420px] w-full max-w-5xl min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Filters</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetStepAndSensor}
              disabled={!selectedDesc && !selectedSensor}
            >
              선택 해제
            </Button>
          </div>
          <div className="grid min-h-0 grid-cols-2">
            <FilterColumn
              title="STEP / desc"
              items={steps.map((item) => ({
                value: item.desc,
                label: item.desc,
                meta: `${item.rowCount.toLocaleString()}건 · ${item.equipmentCount.toLocaleString()} eqp`,
              }))}
              selectedValue={activeDesc}
              query={stepQuery}
              onQueryChange={setStepQuery}
              onSelect={(desc) => {
                setSelectedDesc((current) => current === desc ? "" : desc)
                setSelectedSensor("")
                setSensorQuery("")
              }}
              emptyText={dataQuery.isLoading ? "데이터를 불러오는 중입니다." : "선택 조건에 해당하는 STEP이 없습니다."}
            />
            <FilterColumn
              title="sensor"
              items={sensors.map((item) => ({
                value: item.sensor,
                label: item.sensor,
                meta: `${item.rowCount.toLocaleString()}건`,
              }))}
              selectedValue={activeSensor}
              query={sensorQuery}
              onQueryChange={setSensorQuery}
              onSelect={(sensor) => setSelectedSensor((current) => current === sensor ? "" : sensor)}
              emptyText={selectedDesc ? "선택 STEP에 해당하는 sensor가 없습니다." : "STEP을 먼저 선택하세요."}
            />
          </div>
        </section>

        <section className="grid min-w-0 gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Scatter chart</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                sensor를 선택하면 해당 file_path를 행 단위로 표시합니다.
              </p>
            </div>
            {sensorIsSelected ? (
              <Badge variant="secondary">{chartRows.length.toLocaleString()} charts</Badge>
            ) : null}
          </div>
          {!sensorIsSelected ? (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              STEP과 sensor를 선택하면 scatter chart가 표시됩니다.
            </div>
          ) : chartRows.length ? (
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
