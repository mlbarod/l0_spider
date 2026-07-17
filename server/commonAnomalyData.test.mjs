import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCommonAnomalyPayload,
  buildCommonScatterPayload,
  resolveCommonAnomalyDataPath,
} from "./commonAnomalyData.mjs"

function createPathRow(overrides = {}) {
  return {
    file_path: "/appdata/abnormal_trend/pic_server2/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/EQP-1.png",
    sdwt: "SDWT-1",
    prc_group: "ETCH",
    date: "2026-07-17",
    priority: "A",
    sensor: "TEMP",
    step: "10",
    eqp: "EQP-1.png",
    line_rev: "P1L",
    ...overrides,
  }
}

test("pic_server2를 pic로 바꾸고 마지막 png 파일명을 data.parquet으로 바꾼다", () => {
  assert.equal(
    resolveCommonAnomalyDataPath(createPathRow().file_path),
    "/appdata/abnormal_trend/pic/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/data.parquet",
  )
})

test("Line Name, sdwt, prc_group, eqp ALL, sensor 순서로 경로 행을 필터한다", () => {
  const rows = [
    createPathRow(),
    createPathRow({
      eqp: "EQP-2.png",
      file_path: "/appdata/abnormal_trend/pic_server2/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/EQP-2.png",
    }),
    createPathRow({ sensor: "PRESSURE" }),
    createPathRow({ line_rev: "P2L" }),
  ]
  const payload = buildCommonAnomalyPayload(rows, {
    line: "P1L",
    pathSdwt: "SDWT-1",
    sdwt: "SDWT-1",
    prcGroup: "ETCH",
    eqp: "ALL",
    sensor: "TEMP",
  })

  assert.equal(payload.filters.eqp, "ALL")
  assert.equal(payload.eqps.length, 2)
  assert.equal(payload.rows.length, 2)
  assert.ok(payload.rows.every((row) => row.data_path.endsWith("/data.parquet")))
})

test("공통부 scatter는 선택 eqp_cb와 sensor 컬럼을 사용하고 lotid를 제공한다", () => {
  const payload = buildCommonScatterPayload([
    {
      eqp_id: "EQP-ID-1",
      disp_name: "TEMP DISPLAY",
      lotid: "LOT-1",
      wafer_id: "W01",
      act_time: "2026-07-16 10:00:00",
      TEMP: 12.5,
      eqp_cb: "EQP-1",
    },
    {
      act_time: "2026-07-16 11:00:00",
      TEMP: 99,
      eqp_cb: "EQP-2",
    },
  ], {
    eqp: "EQP-1.png",
    sensor: "TEMP",
    filePath: "/appdata/abnormal_trend/pic/common/test/data.parquet",
  })

  assert.equal(payload.axisColumn, "TEMP")
  assert.equal(payload.points.length, 1)
  assert.equal(payload.points[0].lotId, "LOT-1")
  assert.equal(payload.points[0].value, 12.5)
})
