import assert from "node:assert/strict"
import test from "node:test"
import { filterChartsByStatus } from "./anomalyStatus.mjs"
import { getLowestChStepRowsByPpid } from "./chStepGrouping.mjs"
import { buildSelfEquipmentPayload, TEAM_ERD_COLUMNS } from "../../../../server/selfEquipmentData.mjs"

test("경로 status 보존, 상태 분리 및 모아보기 대표 차트 선정", () => {
  assert.ok(TEAM_ERD_COLUMNS.includes("status"))
  const rows = ["WARN", "ALARM", "WARN"].map((status, index) => ({
    line_rev: "P1L", sdwt: "TEAM", priority: "A", desc: "ETCH",
    eqp: "EQP-1", sensor: "TEMP", recipe_id: "R1", step: String(index + 1),
    file_path: `/chart-${index}.png`, status,
  }))
  const payload = buildSelfEquipmentPayload(rows, {
    line: "P1L", sdwt: "TEAM", priorities: ["A"], desc: "ETCH",
    eqpCh: "ALL", sensor: "ALL", chStep: "ALL",
  })
  assert.deepEqual(payload.rows.map((row) => row.status), ["WARN", "ALARM", "WARN"])
  assert.deepEqual(filterChartsByStatus(payload.rows, "ALARM").map((row) => row.step), ["2"])
  assert.deepEqual(filterChartsByStatus(payload.rows, "WARN").map((row) => row.step), ["1", "3"])
  assert.equal(filterChartsByStatus(payload.rows, ""), payload.rows)
  assert.equal(getLowestChStepRowsByPpid(filterChartsByStatus(payload.rows, "ALARM"))[0].step, "2")
})

test("해당 상태가 없으면 빈 결과이며 상태 미지정 데이터는 전체에서만 표시", () => {
  const rows = [{ status: "WARN" }, {}, { status: null }]
  assert.deepEqual(filterChartsByStatus(rows, "ALARM"), [])
  assert.deepEqual(filterChartsByStatus(rows, "WARN"), [rows[0]])
  assert.equal(filterChartsByStatus(rows, "").length, 3)
})
