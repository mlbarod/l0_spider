import assert from "node:assert/strict"
import test from "node:test"
import { buildChartMailPath, prioritizeLinkedChart } from "./chartMailLinks.mjs"
import { readSelfEquipmentUrlFilters } from "./selfEquipmentUrlFilters.mjs"

test("차트별 조회 조건과 특수문자가 링크에 보존된다", () => {
  const row = { priority: "B", desc: "ETCH / 1", eqp: "EQP.png", sensor: "TEMP & A+B", step: "2@CH", file_path: "/data/a b.parquet" }
  const url = new URL(buildChartMailPath({ app: "self-equipment", line: "L1", sdwt: "TEAM", row }), "https://spider.example")
  assert.equal(url.pathname, "/self-equipment")
  assert.deepEqual(readSelfEquipmentUrlFilters(url.searchParams), { line: "L1", sdwts: ["TEAM"], grades: ["B"], stepToken: "", eqpCh: "EQP.png" })
  for (const [key, value] of Object.entries({ desc: row.desc, sensor: row.sensor, chStep: row.step, chart: row.file_path })) assert.equal(url.searchParams.get(key), value)
  const matching = new URL(buildChartMailPath({ app: "matching-anomaly", line: "L2", sdwt: "T2", row: { sensor: "S", stepDesc: "STEP", chStep: "3", filePath: "/matching/x.png" } }), url)
  assert.equal(matching.pathname, "/matching-anomaly")
  assert.deepEqual(Object.fromEntries(matching.searchParams), { line: "L2", sdwt: "T2", sensor: "S", stepDesc: "STEP", chStep: "3", chart: "/matching/x.png" })
  const common = new URL(buildChartMailPath({ app: "common-anomaly", line: "L3", sdwt: "T3", row: { sensor: "S", prc_group: "P", eqp: "EQP", file_path: "/common/original", data_path: "/common/data.parquet" } }), url)
  assert.deepEqual(Object.fromEntries(common.searchParams), { line: "L3", sdwt: "T3", sensor: "S", prcGroup: "P", eqp: "EQP", chart: "/common/original" })
})

test("메일에서 선택한 차트를 먼저 표시하고 기존 결과와 순서를 보존한다", () => {
  for (const pathKey of ["file_path", "filePath", "data_path"]) {
    const rows = ["a", "b", "c"].map((value) => ({ [pathKey]: value }))
    assert.deepEqual(prioritizeLinkedChart(rows, "c"), [rows[2], rows[0], rows[1]])
    assert.deepEqual(rows.map((row) => row[pathKey]), ["a", "b", "c"])
    assert.equal(prioritizeLinkedChart(rows, "missing"), rows)
    assert.equal(prioritizeLinkedChart(rows, ""), rows)
  }
})
