import { memo, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowUp, Check, ChevronRight, ImageOff, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { createClickedCategoryHistory } from "../api/clickedCategoryHistoryApi"
import {
  buildCommonAnomalyImageUrl,
  fetchCommonAnomalyData,
  fetchCommonAnomalyIdentityData,
  fetchCommonSkipListData,
} from "../api/commonAnomalyApi"
import { fetchCurrentUser } from "../api/currentUserApi"
import { fetchLineMapping } from "../api/mappingConfigApi"
import { deletePassHistory, fetchPassHistory } from "../api/passHistoryApi"
import { SPIDER_LINE_REV } from "../utils/fdcTrendMockData"
import { IdentityChartDialog, SkipChartDialog } from "./FdcTrendPage"

const EMPTY_MAPPING = Object.freeze({})
const EMPTY_LIST = Object.freeze([])
const ALL_EQPS = "ALL"
const COMMON_PASS_HISTORY_VERSION = "NA"
const SKIP_LIST_TEAM = "__SKIP_LIST__"
const SKIP_LIST_LABEL = "SKIP LIST"

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

function normalizePassHistoryDate(value) {
  const text = String(value ?? "")
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/)
  if (!match) return text
  return !match[2] || match[2] === "00:00:00" ? match[1] : `${match[1]} ${match[2]}`
}

function getCommonPathValues(filePath) {
  const normalizedPath = String(filePath ?? "").replaceAll("/pic_server2/", "/pic/")
  const match = normalizedPath.match(/\/common\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/data\.parquet$/i)
  return match ? {
    updateDate: match[1],
    sdwt: match[2],
    desc: match[3],
    priority: match[4],
    sensor: match[5],
    step: match[6],
  } : {}
}

function buildCommonChartPassHistoryKey(lineId, row) {
  const pathValues = getCommonPathValues(row.data_path)
  return [
    lineId,
    COMMON_PASS_HISTORY_VERSION,
    pathValues.sdwt ?? row.sdwt,
    pathValues.desc ?? row.prc_group,
    row.prc_group,
    normalizePassHistoryDate(pathValues.updateDate ?? row.date),
    pathValues.priority ?? row.priority,
    pathValues.sensor ?? row.sensor,
    pathValues.step ?? row.step,
    stripPngExtension(row.eqp),
  ].map((value) => String(value ?? "")).join("\u0000")
}

function buildCommonRecordPassHistoryKey(record) {
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

const CommonAnomalyImageCard = memo(function CommonAnomalyImageCard({
  row,
  lineId,
  passRecord,
}) {
  const eqp = stripPngExtension(row.eqp)
  const queryClient = useQueryClient()
  const [imageFailed, setImageFailed] = useState(false)
  const isSkipped = Boolean(passRecord)
  const imageUrl = buildCommonAnomalyImageUrl(row.image_path)
  const identityRow = useMemo(() => ({
    ...row,
    file_path: row.data_path,
    recipe_id: row.prc_group,
  }), [row])
  const refreshPassHistory = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pass-history", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["common-anomaly-data", lineId] }),
    queryClient.invalidateQueries({ queryKey: ["common-anomaly-skip-list", lineId] }),
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
    deleteSkipMutation.mutate({
      lineId,
      filePath: row.data_path,
      eqp,
      prcGroup: row.prc_group,
    })
  }

  return (
    <article className="grid min-h-[400px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card shadow-sm">
      <header className="border-b bg-muted/50 px-3 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className="shrink-0 text-sm font-semibold">{eqp || "EQP 미지정"}</h3>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.date || "date 미지정"} · {row.prc_group || "prc_group 미지정"} · {row.sensor || "sensor 미지정"} · {row.step || "step 미지정"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSkipped ? <Badge variant="destructive">이상감지 SKIP 건</Badge> : null}
            <Badge variant="outline">{row.priority ? `${row.priority}등급` : "등급 미지정"}</Badge>
          </div>
        </div>
      </header>
      <div className="grid min-h-[320px] place-items-center bg-background p-3">
        {imageFailed ? (
          <div className="grid max-w-full justify-items-center gap-3 px-4 text-center text-sm text-muted-foreground">
            <ImageOff className="size-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-destructive">공통부 이상감지 이미지를 불러오지 못했습니다.</p>
            <code className="max-w-full break-all rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
              {row.image_path}
            </code>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`${eqp} 공통부 이상감지`}
            className="max-h-[520px] w-full object-contain"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SkipChartDialog
            eqp={eqp}
            filePath={row.data_path}
            lineId={lineId}
            prcGroup={row.prc_group}
            dataQueryKeyPrefix="common-anomaly-data"
            disabled={isSkipped}
          />
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
          <IdentityChartDialog
            row={identityRow}
            eqp={eqp}
            identityFetcher={fetchCommonAnomalyIdentityData}
            queryKeyPrefix="common-anomaly-identity-data"
            lotIdLabel="lotid"
          />
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
  const queryClient = useQueryClient()
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
    () => [
      ...Object.entries(lineMapping)
        .filter(([, line]) => line === activeLine)
        .map(([key]) => ({ key, label: sdwtMapping[key] ?? key })),
      ...(activeLine ? [{ key: SKIP_LIST_TEAM, label: SKIP_LIST_LABEL }] : []),
    ],
    [activeLine, lineMapping, sdwtMapping],
  )
  const activeTeam = teamOptions.some((team) => team.key === selectedTeam)
    ? selectedTeam
    : (teamOptions[0]?.key ?? "")
  const activeTeamLabel = teamOptions.find((team) => team.key === activeTeam)?.label ?? ""
  const isSkipList = activeTeam === SKIP_LIST_TEAM
  const dataQueryKey = [
    isSkipList ? "common-anomaly-skip-list" : "common-anomaly-data",
    activeLine,
    activeTeam,
    activeTeamLabel,
    selectedPrcGroup,
    selectedEqp,
    selectedSensor,
  ]
  const dataQuery = useQuery({
    queryKey: dataQueryKey,
    queryFn: () => isSkipList
      ? fetchCommonSkipListData({
          lineId: activeLine,
          prcGroup: selectedPrcGroup,
          eqp: selectedEqp,
          sensor: selectedSensor,
        })
      : fetchCommonAnomalyData({
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
  const passHistoryQuery = useQuery({
    queryKey: ["pass-history", activeLine, activeTeamLabel, COMMON_PASS_HISTORY_VERSION],
    queryFn: () => fetchPassHistory({
      lineId: activeLine,
      sdwt: activeTeamLabel,
      desc: "",
    }),
    enabled: Boolean(!isSkipList && activeLine && activeTeamLabel),
    staleTime: 30 * 1000,
    retry: false,
  })
  const passHistoryByKey = useMemo(() => new Map(
    (passHistoryQuery.data?.records ?? EMPTY_LIST)
      .filter((record) => record.ver === COMMON_PASS_HISTORY_VERSION)
      .map((record) => [buildCommonRecordPassHistoryKey(record), record]),
  ), [passHistoryQuery.data?.records])
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
  const handleSensorChange = async (sensor) => {
    const nextSensor = selectedSensor === sensor ? "" : sensor
    const clickedAt = new Date().toISOString()
    setSelectedSensor(nextSensor)
    if (!nextSensor || isSkipList) return

    try {
      const queryKey = [
        "common-anomaly-data",
        activeLine,
        activeTeam,
        activeTeamLabel,
        selectedPrcGroup,
        selectedEqp,
        nextSensor,
      ]
      const payload = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchCommonAnomalyData({
          line: activeLine,
          pathSdwt: activeTeam,
          sdwt: activeTeamLabel,
          prcGroup: selectedPrcGroup,
          eqp: selectedEqp,
          sensor: nextSensor,
        }),
      })
      const filePaths = (payload.rows ?? []).map((row) => row.data_path)
      if (!filePaths.length) return
      await createClickedCategoryHistory({
        app: "common",
        lineId: activeLine,
        filePaths,
        clickedAt,
      })
    } catch (error) {
      toast.error(`클릭이력 저장 실패: ${error.message}`)
    }
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
                ? `${currentUserQuery.data.username || currentUserQuery.data.knoxId} (${currentUserQuery.data.knoxId})님 안녕하세요!`
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
                  void handleSensorChange(item.value)
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
        {passHistoryQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            PASS 이력을 불러오지 못했습니다: {passHistoryQuery.error.message}
          </div>
        ) : null}
        <section className="grid min-w-0 gap-3">
          {!sensorIsSelected ? (
            <div className="grid min-h-52 place-items-center rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              prc_group, eqp와 sensor를 선택하면 이상감지 이미지가 표시됩니다.
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
                    <Badge variant="secondary">{group.rows.length.toLocaleString()} images</Badge>
                  </header>
                  <div className="grid min-w-0 grid-cols-1 gap-4 p-4 md:grid-cols-2">
                    {group.rows.map((row) => (
                      <CommonAnomalyImageCard
                        key={row.id}
                        row={row}
                        lineId={activeLine}
                        passRecord={isSkipList
                          ? row.pass_history
                          : passHistoryByKey.get(buildCommonChartPassHistoryKey(activeLine, row))}
                      />
                    ))}
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
