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

test("EQP 대소문자와 하위 채널 접미사를 허용하고 숫자형 act_time을 변환한다", () => {
  const actTimeMs = Date.UTC(2026, 6, 17, 3)
  const payload = buildCommonScatterPayload([
    {
      act_time: actTimeMs,
      TEMP: 7.25,
      eqp_cb: "EQP-1_CH1",
    },
  ], {
    eqp: "eqp-1.png",
    sensor: "TEMP",
    filePath: "/appdata/abnormal_trend/pic/common/test/data.parquet",
    imagePath: "/appdata/abnormal_trend/pic_server2/common/test/EQP-1.png",
  })

  assert.equal(payload.points.length, 1)
  assert.equal(payload.points[0].actTimeMs, actTimeMs)
  assert.deepEqual(payload.diagnostics.matchedEqpCbs, ["EQP-1_CH1"])
  assert.equal(payload.diagnostics.eqpMatchedRows, 1)
})

test("유효 데이터가 없으면 제외 사유와 drawing 파일 경로를 응답한다", () => {
  const filePath = "/appdata/abnormal_trend/pic/common/test/data.parquet"
  const payload = buildCommonScatterPayload([
    { act_time: "invalid", TEMP: 1, eqp_cb: "EQP-1" },
    { act_time: "2026-07-17 12:00:00", TEMP: null, eqp_cb: "EQP-1" },
  ], { eqp: "EQP-1", sensor: "TEMP", filePath })

  assert.equal(payload.sourcePath, filePath)
  assert.equal(payload.pointCount, 0)
  assert.equal(payload.diagnostics.invalidActTimeRows, 1)
  assert.equal(payload.diagnostics.invalidValueRows, 1)
})

test("eqp_cb가 직접 일치하지 않으면 eqp_id로 연결된 eqp_cb를 사용한다", () => {
  const payload = buildCommonScatterPayload([
    {
      eqp_id: "EQP-1",
      eqp_cb: "CHAMBER-A",
      act_time: "2026-07-17 12:00:00",
      TEMP: "1,234.5",
    },
    {
      eqp_id: "EQP-2",
      eqp_cb: "CHAMBER-B",
      act_time: "2026-07-17 12:00:00",
      TEMP: 2,
    },
  ], {
    eqp: "eqp-1.png",
    sensor: "TEMP",
    filePath: "/appdata/abnormal_trend/pic/common/test/data.parquet",
  })

  assert.equal(payload.points.length, 1)
  assert.equal(payload.points[0].value, 1234.5)
  assert.equal(payload.diagnostics.matchStrategy, "eqp_id")
  assert.deepEqual(payload.diagnostics.matchedEqpCbs, ["CHAMBER-A"])
})

test("parquet에 eqp_cb가 하나뿐이면 해당 값으로 안전하게 fallback한다", () => {
  const payload = buildCommonScatterPayload([
    {
      eqp_cb: "ONLY-CHAMBER",
      act_time: "2026-07-17 12:00:00",
      TEMP: 3,
    },
  ], {
    eqp: "UNRELATED-EQP",
    sensor: "TEMP",
    filePath: "/appdata/abnormal_trend/pic/common/test/data.parquet",
  })

  assert.equal(payload.points.length, 1)
  assert.equal(payload.diagnostics.matchStrategy, "single-eqp-cb")
})
