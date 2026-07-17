import assert from "node:assert/strict"
import test from "node:test"

import {
  DASHBOARD_DETAIL_COLUMNS,
  DASHBOARD_STATS_COLUMNS,
  buildDashboardSummary,
} from "./dashboardData.mjs"

test("대시보드 참조 컬럼 계약을 유지한다", () => {
  assert.deepEqual(DASHBOARD_STATS_COLUMNS, ["exec_date", "recipe_id", "priority", "ng", "total"])
  assert.deepEqual(DASHBOARD_DETAIL_COLUMNS, ["sdwt", "desc", "recipe_id", "priority", "sensor"])
})

test("TL total 합계와 세부 파일의 컬럼 조합 고유건수로 대시보드 지표를 계산한다", () => {
  const statsRows = [
    { recipe_id: "TL-1", priority: "TL", ng: 999, total: 100 },
    { recipe_id: "TL-2", priority: "tl", ng: 999, total: "50" },
  ]
  const detailRows = [
    { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP" },
    { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP" },
    { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "B", sensor: "TEMP" },
    { sdwt: "S2", desc: "ASH", recipe_id: "R2", priority: "D", sensor: "TEMP" },
    { sdwt: "S2", desc: "ASH", recipe_id: "R2", priority: "D", sensor: "TEMP" },
    { sdwt: "S3", desc: "DEP", recipe_id: "R3", priority: "N", sensor: "PRESSURE" },
    { sdwt: "S4", desc: "CVD", recipe_id: "R4", priority: "M", sensor: "FLOW" },
    { sdwt: "S5", desc: "CLEAN", recipe_id: "R5", priority: "X", sensor: "TIME" },
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
