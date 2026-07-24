import assert from "node:assert/strict"
import test from "node:test"

import { buildClickedCategoryHistoryRecord } from "./clickedCategoryHistory.mjs"

test("자설비 Drawing 경로와 선택 grade 목록을 클릭이력으로 변환한다", () => {
  const clickedAt = "2026-07-17T13:00:00+09:00"
  const record = buildClickedCategoryHistoryRecord({
    app: "self",
    lineId: "P1L",
    filePaths: [
      "/appdata/abnormal_trend/pic/erd/2026-07-17/SDWT-1/ETCH/V1/PPID-1/A/TEMP/10@001/EQP-1.png",
      "/appdata/abnormal_trend/pic/erd/2026-07-17/SDWT-1/ETCH/V1/PPID-1/B/TEMP/10@001/EQP-2.png",
    ],
    grades: ["A", "B", "D"],
    clickedAt,
    knoxId: "user1",
  })

  assert.deepEqual(record, {
    lineId: "P1L",
    sdwt: "SDWT-1",
    grade: "['A', 'B', 'D']",
    sensor: "TEMP",
    updateDate: clickedAt,
    knoxId: "user1",
  })
})

test("동일성 Drawing 경로는 Line에 (g)를 붙이고 경로의 grade와 sensor를 사용한다", () => {
  const record = buildClickedCategoryHistoryRecord({
    app: "commonality",
    lineId: "P2L",
    filePaths: [
      "/appdata/abnormal_trend/pic/erd_commonality/2026-07-17 12:00:00/SDWT-2/A/100/MAIN/PPID-1/PPID-1/PRESSURE_SENSOR_10@001/img.png",
    ],
    clickedAt: "2026-07-17T14:00:00+09:00",
    knoxId: "user2",
  })

  assert.equal(record.lineId, "P2L(g)")
  assert.equal(record.sdwt, "SDWT-2")
  assert.equal(record.grade, "A")
  assert.equal(record.sensor, "PRESSURE_SENSOR")
})

test("동일성 클릭이력은 서로 다른 step_desc 경로도 기존 컬럼 구조로 집계한다", () => {
  const record = buildClickedCategoryHistoryRecord({
    app: "commonality",
    lineId: "P2L",
    filePaths: [
      "/appdata/abnormal_trend/pic/erd_commonality/2026-07-17 12:00:00/SDWT-2/A/100/MAIN/PPID-1/PPID-1/PRESSURE_SENSOR_10@001/img.png",
      "/appdata/abnormal_trend/pic/erd_commonality/2026-07-17 12:00:00/SDWT-2/B/200/OVER/PPID-2/PPID-2/TEMP_20@001/img.png",
    ],
    clickedAt: "2026-07-17T14:00:00+09:00",
    knoxId: "user2",
  })

  assert.deepEqual(record, {
    lineId: "P2L(g)",
    sdwt: "SDWT-2",
    grade: "['A', 'B']",
    sensor: "['PRESSURE_SENSOR', 'TEMP']",
    updateDate: "2026-07-17T14:00:00+09:00",
    knoxId: "user2",
  })
  assert.equal(Object.hasOwn(record, "stepDesc"), false)
})

test("동일성 Sensor ALL 클릭이력은 sensor 컬럼에 ALL을 저장한다", () => {
  const record = buildClickedCategoryHistoryRecord({
    app: "commonality",
    lineId: "P2L",
    filePaths: [
      "/appdata/abnormal_trend/pic/erd_commonality/2026-07-17 12:00:00/SDWT-2/A/100/MAIN/PPID-1/PPID-1/PRESSURE_SENSOR_10@001/img.png",
      "/appdata/abnormal_trend/pic/erd_commonality/2026-07-17 12:00:00/SDWT-2/B/100/MAIN/PPID-2/PPID-2/TEMP_20@001/img.png",
    ],
    selectedSensor: "ALL",
    clickedAt: "2026-07-17T14:00:00+09:00",
    knoxId: "user2",
  })

  assert.equal(record.lineId, "P2L(g)")
  assert.equal(record.sdwt, "SDWT-2")
  assert.equal(record.grade, "['A', 'B']")
  assert.equal(record.sensor, "ALL")
  assert.equal(Object.hasOwn(record, "stepDesc"), false)
})

test("공통부 Drawing 경로는 Line에 (c)를 붙이고 여러 grade를 보존한다", () => {
  const record = buildClickedCategoryHistoryRecord({
    app: "common",
    lineId: "P3L",
    filePaths: [
      "/appdata/abnormal_trend/pic/common/2026-07-17/SDWT-3/ETCH/A/TEMP/10/data.parquet",
      "/appdata/abnormal_trend/pic/common/2026-07-17/SDWT-3/ETCH/B/TEMP/20/data.parquet",
    ],
    clickedAt: "2026-07-17T15:00:00+09:00",
    knoxId: "user3",
  })

  assert.equal(record.lineId, "P3L(c)")
  assert.equal(record.sdwt, "SDWT-3")
  assert.equal(record.grade, "['A', 'B']")
  assert.equal(record.sensor, "TEMP")
})
