import assert from "node:assert/strict"
import test from "node:test"

import {
  SKIP_EXCLUSION_DURATION_MS,
  buildSelfEquipmentPayload,
  excludeRecentlySkippedRows,
  filterMyEqpRows,
} from "./selfEquipmentData.mjs"

const NOW = Date.parse("2026-07-16T12:00:00+09:00")

function createRow(overrides = {}) {
  return {
    line_rev: "P1L",
    sdwt: "SDWT-1",
    desc: "ETCH",
    ver: "V1",
    recipe_id: "R1",
    priority: "A",
    sensor: "TEMP",
    step: "10@MAIN",
    eqp: "EQP-1.png",
    file_path: "/appdata/abnormal_trend/pic/erd/2026-07-16/SDWT-1/ETCH/V1/R1/A/TEMP/10@MAIN/EQP-1.png",
    ...overrides,
  }
}

function createPassRecord(overrides = {}) {
  return {
    line_id: "P1L",
    sdwt: "SDWT-1",
    desc: "ETCH",
    ver: "V1",
    recipe_id: "R1",
    priority: "A",
    sensor: "TEMP",
    step: "10@MAIN",
    eqp: "EQP-1",
    exec_date: "2026-07-14T12:00:00+09:00",
    ...overrides,
  }
}

test("latest_date가 달라도 나머지 경로 식별값이 같으면 3일간 제외한다", () => {
  const olderLatestDateRow = createRow({
    file_path: "/appdata/abnormal_trend/pic/erd/2026-07-15/SDWT-1/ETCH/V1/R1/A/TEMP/10@MAIN/EQP-1.png",
  })

  assert.deepEqual(
    excludeRecentlySkippedRows([olderLatestDateRow], [createPassRecord()], NOW),
    [],
  )
})

test("latest_date 외의 경로 식별값이 다르면 제외하지 않는다", () => {
  const differentSensorRow = createRow({ sensor: "PRESSURE" })

  assert.deepEqual(
    excludeRecentlySkippedRows([differentSensorRow], [createPassRecord()], NOW),
    [differentSensorRow],
  )
})

test("SKIP 등록 후 정확히 3일이 지나면 일반 이상건수에 다시 포함한다", () => {
  const row = createRow()
  const expiredRecord = createPassRecord({
    exec_date: new Date(NOW - SKIP_EXCLUSION_DURATION_MS).toISOString(),
  })

  assert.deepEqual(excludeRecentlySkippedRows([row], [expiredRecord], NOW), [row])
})

test("My EQP는 등록된 sdwt와 eqp가 모두 일치하는 이상건만 남긴다", () => {
  const rows = [
    createRow({ sdwt: "SDWT-1", eqp: "EQP-1.png" }),
    createRow({ sdwt: "SDWT-2", eqp: "EQP-1.png" }),
    createRow({ sdwt: "SDWT-1", eqp: "EQP-2.png" }),
  ]
  const registrations = [{ sdwt: "sdwt-1", eqp: "eqp-1" }]

  assert.deepEqual(filterMyEqpRows(rows, registrations), [rows[0]])
})

test("My EQP 전체 Sensor Grade 조건에서는 모든 등급의 STEP을 제공한다", () => {
  const rows = [
    createRow({ priority: "A", desc: "STEP-A" }),
    createRow({ priority: "D", desc: "STEP-D" }),
    createRow({ priority: "M", desc: "STEP-M" }),
  ]
  const payload = buildSelfEquipmentPayload(rows, {
    line: "P1L",
    pathSdwt: "__MY_EQP__",
    sdwt: "MY EQP",
    includeAllSdwt: true,
    priorities: ["A", "B", "D", "N", "M"],
    desc: "",
    eqpCh: "",
    sensor: "",
    chStep: "",
  })

  assert.deepEqual(payload.steps.map((step) => step.desc), ["STEP-A", "STEP-D", "STEP-M"])
})
