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

test("TL total 합계와 Grade별 ng 합계로 대시보드 지표를 계산한다", () => {
  const statsRows = [
    { recipe_id: "TL-1", priority: "TL", ng: 999, total: 100 },
    { recipe_id: "TL-2", priority: "tl", ng: 999, total: "50" },
    { recipe_id: "R1", priority: "A", ng: 2, total: 10 },
    { recipe_id: "R1", priority: "B", ng: "3", total: 10 },
    { recipe_id: "R2", priority: "A/B", ng: 4, total: 10 },
    { recipe_id: "R3", priority: "D", ng: 5, total: 10 },
    { recipe_id: "R4", priority: "N", ng: 6, total: 10 },
    { recipe_id: "R5", priority: "M", ng: 7, total: 10 },
    { recipe_id: "R6", priority: "M", ng: 0, total: 10 },
    { recipe_id: "IGNORED", priority: "X", ng: 100, total: 100 },
  ]
  const detailRows = [
    { sdwt: "S1", desc: "ETCH", recipe_id: "R1", priority: "A", sensor: "TEMP" },
    { sdwt: "S1", desc: "ETCH", recipe_id: "R2", priority: "B", sensor: "PRESSURE" },
    { sdwt: "S2", desc: "ASH", recipe_id: "R2", priority: "D", sensor: "TEMP" },
  ]

  const payload = buildDashboardSummary(statsRows, detailRows, {
    latestDate: "2026-07-17 12:00:00",
    statsPath: "/stats/latest.parquets",
    detailPath: "/path/latest",
  })

  assert.deepEqual(payload.metrics, {
    monitoringSensorTotal: 150,
    detectedPpidCount: 5,
    totalAnomalyCount: 27,
    abGradeCount: 9,
    dGradeCount: 5,
    nGradeCount: 6,
    mGradeCount: 7,
  })
  assert.deepEqual(payload.detailCounts, {
    rows: 3,
    sdwt: 2,
    steps: 2,
    recipeIds: 2,
    sensors: 2,
  })
  assert.equal(payload.latestDate, "2026-07-17 12:00:00")
})

test("숫자로 변환할 수 없는 null 및 문자열 값은 합계에서 0으로 처리한다", () => {
  const payload = buildDashboardSummary([
    { recipe_id: "R1", priority: "TL", total: null },
    { recipe_id: "R2", priority: "TL", total: "invalid" },
    { recipe_id: "R3", priority: "D", ng: undefined },
  ], [])

  assert.equal(payload.metrics.monitoringSensorTotal, 0)
  assert.equal(payload.metrics.totalAnomalyCount, 0)
  assert.equal(payload.metrics.detectedPpidCount, 0)
})
