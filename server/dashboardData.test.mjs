import assert from "node:assert/strict"
import test from "node:test"

import {
  DASHBOARD_DETAIL_COLUMNS,
  DASHBOARD_STATS_COLUMNS,
  LINE_ANOMALY_ID_COLUMNS,
  buildDashboardSummary,
  buildLineDashboardPayload,
  getPreviousDashboardDateTime,
  resolveDashboardDateRange,
  selectLatestDashboardFilePerDate,
  selectPreviousDashboardFileAtSameTime,
} from "./dashboardData.mjs"
import { formatLineDisplayName } from "../src/features/fdc-trend/utils/lineDisplay.mjs"

test("대시보드 참조 컬럼 계약을 유지한다", () => {
  assert.deepEqual(DASHBOARD_STATS_COLUMNS, ["exec_date", "recipe_id", "priority", "ng", "total"])
  assert.deepEqual(DASHBOARD_DETAIL_COLUMNS, ["sdwt", "desc", "recipe_id", "priority", "sensor", "eqp"])
  assert.deepEqual(LINE_ANOMALY_ID_COLUMNS, ["desc", "recipe_id", "priority", "sensor", "eqp"])
})

test("P4D는 화면에서만 P3D2로 표시하고 다른 내부 라인명은 유지한다", () => {
  assert.equal(formatLineDisplayName("P4D"), "P3D2")
  assert.equal(formatLineDisplayName("P1"), "P1")
})

test("TL total 합계와 세부 파일의 컬럼 조합 고유건수로 대시보드 지표를 계산한다", () => {
  const statsRows = [
    { recipe_id: "TL-1", priority: "TL", ng: 999, total: 100 },
    { recipe_id: "TL-2", priority: "tl", ng: 999, total: "50" },
  ]
  const detailRows = [
    { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP", eqp: "EQ1" },
    { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP", eqp: "EQ1" },
    { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "B", sensor: "TEMP", eqp: "EQ1" },
    { sdwt: "S2", desc: "ASH", recipe_id: "R2", priority: "D", sensor: "TEMP", eqp: "EQ2" },
    { sdwt: "S2", desc: "ASH", recipe_id: "R2", priority: "D", sensor: "TEMP", eqp: "EQ2" },
    { sdwt: "S3", desc: "DEP", recipe_id: "R3", priority: "N", sensor: "PRESSURE", eqp: "EQ3" },
    { sdwt: "S4", desc: "CVD", recipe_id: "R4", priority: "M", sensor: "FLOW", eqp: "EQ4" },
    { sdwt: "S5", desc: "CLEAN", recipe_id: "R5", priority: "X", sensor: "TIME", eqp: "EQ5" },
  ]

  const payload = buildDashboardSummary(statsRows, detailRows, {
    latestDate: "2026-07-17 12:00:00",
    statsPath: "/stats/latest.parquets",
    detailPath: "/path/latest",
  })

  assert.deepEqual(payload.metrics, {
    monitoringSensorTotal: 150,
    detectedPpidCount: 5,
    totalAnomalyCount: 6,
    abGradeCount: 2,
    dGradeCount: 1,
    nGradeCount: 1,
    mGradeCount: 1,
  })
  assert.deepEqual(payload.detailCounts, {
    rows: 8,
    sdwt: 5,
    steps: 5,
    recipeIds: 5,
    sensors: 4,
  })
  assert.equal(payload.latestDate, "2026-07-17 12:00:00")
})

test("TL total에서 숫자로 변환할 수 없는 값은 0으로 처리한다", () => {
  const payload = buildDashboardSummary([
    { recipe_id: "R1", priority: "TL", total: null },
    { recipe_id: "R2", priority: "TL", total: "invalid" },
    { recipe_id: "R3", priority: "D", ng: undefined },
  ], [])

  assert.equal(payload.metrics.monitoringSensorTotal, 0)
  assert.equal(payload.metrics.totalAnomalyCount, 0)
  assert.equal(payload.metrics.detectedPpidCount, 0)
})

const mappingConfig = {
  line_mapping: {
    S1: "P1",
    S2: "P1",
    S3: "P2",
  },
  sdwt_mapping: {
    S1: "SDWT 1",
    S2: "SDWT 2",
    S3: "SDWT 3",
  },
}

const datedRows = [
  {
    dateTime: "2026-07-15 08:00:00",
    rows: [
      { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP", eqp: "EQ1" },
      { sdwt: "S2", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP", eqp: "EQ1" },
      { sdwt: "SDWT 1", desc: "ASH", recipe_id: "R2", priority: "B", sensor: "PRESSURE", eqp: "EQ2" },
      { sdwt: "S3", desc: "DEP", recipe_id: "R3", priority: "D", sensor: "FLOW", eqp: "EQ3" },
      { sdwt: "UNKNOWN", desc: "CLEAN", recipe_id: "RX", priority: "M", sensor: "TIME", eqp: "EQ4" },
      { sdwt: "", desc: "CLEAN", recipe_id: "RY", priority: "M", sensor: "TIME", eqp: "EQ5" },
    ],
  },
  {
    dateTime: "2026-07-16 08:00:00",
    rows: [
      { sdwt: "S1", desc: "ETCH", recipe_id: "R4", priority: "A", sensor: "TEMP", eqp: "EQ1" },
      { sdwt: "S3", desc: "DEP", recipe_id: "R5", priority: "D", sensor: "FLOW", eqp: "EQ3" },
    ],
  },
]

function buildLinePayload(overrides = {}, rows = datedRows) {
  return buildLineDashboardPayload(rows, mappingConfig, {
    startDate: "2026-07-15",
    endDate: "2026-07-17",
    minDate: "2026-07-15",
    maxDate: "2026-07-16",
    defaultStartDate: "2026-07-15",
    defaultEndDate: "2026-07-16",
    monitoringSensorTotal: 150,
    lines: [],
    comparisonDateTime: "2026-07-15 08:00:00",
    comparisonRows: datedRows[0].rows,
    ...overrides,
  })
}

test("sdwt를 라인으로 매핑한 뒤 날짜·라인별 5개 컬럼 고유조합을 집계한다", () => {
  const payload = buildLinePayload()

  assert.deepEqual(payload.summary, {
    totalAbnormalCount: 5,
    abnormalLineCount: 2,
    latestDate: "2026-07-16",
    latestDateTime: "2026-07-16 08:00:00",
    latestDateCount: 2,
    topLine: "P1",
    topLineCount: 3,
    previousDate: "2026-07-15",
    previousDateTime: "2026-07-15 08:00:00",
    changeFromPreviousDay: -1,
    monitoringSensorTotal: 150,
    abGradeCount: 3,
    dGradeCount: 2,
    nGradeCount: 0,
    mGradeCount: 0,
  })
  assert.deepEqual(payload.lineSummary, [
    {
      lineId: "P1",
      totalCount: 3,
      abGradeCount: 3,
      latestDateCount: 1,
      previousDateCount: 2,
      changeCount: -1,
      lastAbnormalDate: "2026-07-16",
      ratio: 60,
      sdwts: ["SDWT 1", "SDWT 2"],
      sensorGrades: ["A/B"],
    },
    {
      lineId: "P2",
      totalCount: 2,
      abGradeCount: 0,
      latestDateCount: 1,
      previousDateCount: 1,
      changeCount: 0,
      lastAbnormalDate: "2026-07-16",
      ratio: 40,
      sdwts: ["SDWT 3"],
      sensorGrades: ["D"],
    },
  ])
  assert.equal(payload.meta.unmappedRows, 2)
})

test("데이터 파일이 없는 날짜도 라인별 0건으로 채우고 날짜 오름차순을 유지한다", () => {
  const payload = buildLinePayload()

  assert.deepEqual(payload.dailyTrend, [
    { date: "2026-07-15", lineId: "P1", abnormalCount: 2 },
    { date: "2026-07-15", lineId: "P2", abnormalCount: 1 },
    { date: "2026-07-16", lineId: "P1", abnormalCount: 1 },
    { date: "2026-07-16", lineId: "P2", abnormalCount: 1 },
    { date: "2026-07-17", lineId: "P1", abnormalCount: 0 },
    { date: "2026-07-17", lineId: "P2", abnormalCount: 0 },
  ])
  assert.equal(
    payload.dailyTrend.reduce((sum, row) => sum + row.abnormalCount, 0),
    payload.summary.totalAbnormalCount,
  )
})

test("같은 날짜의 여러 시각 파일 중 hh:mm:ss가 가장 최신인 파일만 선택한다", () => {
  const sameDayFiles = [
    datedRows[0],
    {
      dateTime: "2026-07-15 16:00:00",
      rows: [
        { sdwt: "S2", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP", eqp: "EQ1" },
        { sdwt: "S2", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP", eqp: "EQ2" },
        { sdwt: "S1", desc: "CLEAN", recipe_id: "R6", priority: "M", sensor: "TIME", eqp: "EQ1" },
      ],
    },
  ]
  const selectedFiles = selectLatestDashboardFilePerDate(
    sameDayFiles.map((item) => ({ dateTime: item.dateTime, filePath: `/path/${item.dateTime}` })),
    "2026-07-15",
    "2026-07-15",
  )
  assert.deepEqual(selectedFiles.map((file) => file.dateTime), ["2026-07-15 16:00:00"])

  const payload = buildLinePayload({
    startDate: "2026-07-15",
    endDate: "2026-07-15",
    comparisonDateTime: "",
    comparisonRows: [],
  }, [sameDayFiles[1]])

  assert.equal(payload.summary.totalAbnormalCount, 3)
  assert.equal(payload.lineSummary.find((row) => row.lineId === "P1").totalCount, 3)
})

test("단일 라인과 복수 라인 필터가 전체 KPI·추이·표에 동일하게 적용된다", () => {
  const single = buildLinePayload({ lines: ["P2"] })
  assert.equal(single.summary.totalAbnormalCount, 2)
  assert.equal(single.summary.abnormalLineCount, 1)
  assert.deepEqual(single.lineSummary.map((row) => row.lineId), ["P2"])
  assert.ok(single.dailyTrend.every((row) => row.lineId === "P2"))

  const multiple = buildLinePayload({ lines: ["P2", "P1"] })
  assert.equal(multiple.summary.totalAbnormalCount, 5)
  assert.deepEqual(multiple.lineSummary.map((row) => row.lineId), ["P1", "P2"])
})

test("하루 조회는 해당 날짜만 집계하며 전일 파일이 없으면 비교값을 null로 반환한다", () => {
  const payload = buildLinePayload({
    startDate: "2026-07-16",
    endDate: "2026-07-16",
    lines: ["P1"],
    comparisonDateTime: "",
    comparisonRows: [],
  }, [datedRows[1]])

  assert.equal(payload.summary.totalAbnormalCount, 1)
  assert.equal(payload.summary.changeFromPreviousDay, null)
  assert.equal(payload.lineSummary[0].previousDateCount, null)
  assert.deepEqual(payload.dailyTrend, [
    { date: "2026-07-16", lineId: "P1", abnormalCount: 1 },
  ])
})

test("데이터가 없는 기간에 선택 라인은 0건으로 표시하고 비교 데이터는 제공하지 않는다", () => {
  const payload = buildLinePayload({
    startDate: "2026-07-20",
    endDate: "2026-07-21",
    lines: ["P1"],
    comparisonDateTime: "",
    comparisonRows: [],
  }, [])

  assert.equal(payload.summary.totalAbnormalCount, 0)
  assert.equal(payload.summary.latestDate, null)
  assert.equal(payload.summary.changeFromPreviousDay, null)
  assert.deepEqual(payload.dailyTrend, [
    { date: "2026-07-20", lineId: "P1", abnormalCount: 0 },
    { date: "2026-07-21", lineId: "P1", abnormalCount: 0 },
  ])
})

test("전일 비교 기준 일시는 최신 파일에서 하루 전으로 계산한다", () => {
  assert.equal(
    getPreviousDashboardDateTime("2026-07-17 16:30:45"),
    "2026-07-16 16:30:45",
  )
  assert.equal(getPreviousDashboardDateTime("2026-07-17 25:00:00"), null)
})

test("전일 비교는 D-1의 동일 hh:mm 파일 중 초가 가장 최신인 파일을 선택한다", () => {
  const files = [
    { dateTime: "2026-07-16 08:00:10", filePath: "/path/morning-early" },
    { dateTime: "2026-07-16 16:00:00", filePath: "/path/evening" },
    { dateTime: "2026-07-16 08:00:45", filePath: "/path/morning-latest" },
    { dateTime: "2026-07-17 08:00:30", filePath: "/path/latest" },
  ]

  assert.equal(
    selectPreviousDashboardFileAtSameTime(files, "2026-07-17 08:00:30")?.filePath,
    "/path/morning-latest",
  )
  assert.equal(selectPreviousDashboardFileAtSameTime(files, "2026-07-17 12:00:00"), null)
})

test("전일 대비는 기간 집계 파일이 아니라 D-1 동일 시각 파일 행으로 계산한다", () => {
  const payload = buildLinePayload({
    comparisonDateTime: "2026-07-15 08:00:00",
    comparisonRows: [
      { sdwt: "S1", desc: "OLDER", recipe_id: "R10", priority: "A", sensor: "TEMP", eqp: "EQ1" },
    ],
  })

  assert.equal(payload.summary.latestDateCount, 2)
  assert.equal(payload.summary.changeFromPreviousDay, 1)
  assert.equal(payload.lineSummary.find((row) => row.lineId === "P1").previousDateCount, 1)
})

test("기본 조회 시작일과 종료일은 모두 가장 최신 데이터 날짜이며 잘못된 날짜를 거부한다", () => {
  const range = resolveDashboardDateRange([
    "2026-07-01 08:00:00",
    "2026-07-17 08:00:00",
    "2026-99-99 08:00:00",
    "not-a-date",
  ])
  assert.deepEqual(range, {
    startDate: "2026-07-17",
    endDate: "2026-07-17",
    minDate: "2026-07-01",
    maxDate: "2026-07-17",
    defaultStartDate: "2026-07-17",
    defaultEndDate: "2026-07-17",
  })
  assert.throws(
    () => resolveDashboardDateRange(["2026-07-17 08:00:00"], {
      startDate: "2026-07-18",
      endDate: "2026-07-17",
    }),
    /조회 시작일은 종료일보다 늦을 수 없습니다/,
  )
})
