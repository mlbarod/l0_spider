import assert from "node:assert/strict"
import test from "node:test"

import {
  COMMON_PASS_HISTORY_VERSION,
  PASS_HISTORY_ACTIVE_DURATION_MS,
  buildCommonPassHistoryFilterPayload,
  buildPassHistoryFilterPayload,
  parseCommonPassHistoryPath,
} from "./passHistory.mjs"

const NOW = Date.parse("2026-07-17T15:00:00+09:00")

test("공통부 data.parquet 경로를 pass_history 값으로 변환한다", () => {
  const values = parseCommonPassHistoryPath(
    "/appdata/abnormal_trend/pic/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/data.parquet",
    { eqp: "EQP-1.png", prcGroup: "PRC-GROUP-1" },
  )

  assert.deepEqual(values, {
    updateDate: "2026-07-17",
    sdwt: "SDWT-1",
    desc: "ETCH",
    ver: COMMON_PASS_HISTORY_VERSION,
    recipeId: "PRC-GROUP-1",
    priority: "A",
    sensor: "TEMP",
    step: "10",
    eqp: "EQP-1",
  })
})

test("공통부 PASS 이력은 자설비 SKIP LIST 필터에서 제외한다", () => {
  const payload = buildPassHistoryFilterPayload([
    {
      line_id: "P1L",
      ver: COMMON_PASS_HISTORY_VERSION,
      sdwt: "SDWT-1",
      desc: "ETCH",
      recipe_id: "PRC-GROUP-1",
      update_date: "2026-07-17",
      priority: "A",
      sensor: "TEMP",
      step: "10",
      eqp: "EQP-1",
    },
  ], {
    lineId: "P1L",
    priorities: ["A"],
    desc: "",
    eqpCh: "",
    sensor: "",
    chStep: "",
  })

  assert.equal(payload.counts.filteredRows, 0)
  assert.deepEqual(payload.rows, [])
})

test("공통부 PASS 이력을 공통부 SKIP LIST 이미지 행으로 복원한다", () => {
  const commonRecord = {
    line_id: "P1L",
    ver: COMMON_PASS_HISTORY_VERSION,
    sdwt: "SDWT-1",
    desc: "ETCH",
    recipe_id: "PRC-GROUP-1",
    update_date: "2026-07-17",
    priority: "A",
    sensor: "TEMP",
    step: "10",
    eqp: "EQP-1",
    exec_date: "2026-07-17 12:00:00",
  }
  const payload = buildCommonPassHistoryFilterPayload([
    commonRecord,
    { ...commonRecord, ver: "V1", eqp: "SELF-EQP" },
  ], {
    lineId: "P1L",
    prcGroup: "PRC-GROUP-1",
    eqp: "ALL",
    sensor: "TEMP",
  }, NOW)

  assert.equal(COMMON_PASS_HISTORY_VERSION, "NA")
  assert.equal(payload.filters.sdwt, "SKIP LIST")
  assert.equal(payload.rows.length, 1)
  assert.equal(
    payload.rows[0].data_path,
    "/appdata/abnormal_trend/pic/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/data.parquet",
  )
  assert.equal(
    payload.rows[0].image_path,
    "/appdata/abnormal_trend/pic/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/EQP-1.png",
  )
  assert.equal(payload.rows[0].pass_history, commonRecord)
})

test("자설비와 공통부 SKIP LIST는 3일이 지난 이력을 UI payload에서 제외한다", () => {
  const expiredExecDate = new Date(NOW - PASS_HISTORY_ACTIVE_DURATION_MS).toISOString()
  const baseRecord = {
    line_id: "P1L",
    ver: "V1",
    sdwt: "SDWT-1",
    desc: "ETCH",
    recipe_id: "PPID-1",
    update_date: "2026-07-17",
    priority: "A",
    sensor: "TEMP",
    step: "10",
    eqp: "EQP-1",
    exec_date: expiredExecDate,
  }
  const selfPayload = buildPassHistoryFilterPayload([baseRecord], {
    lineId: "P1L",
    priorities: ["A"],
    desc: "ETCH",
    eqpCh: "ALL",
    sensor: "TEMP",
    chStep: "ALL",
  }, NOW)
  const commonPayload = buildCommonPassHistoryFilterPayload([
    { ...baseRecord, ver: COMMON_PASS_HISTORY_VERSION },
  ], {
    lineId: "P1L",
    prcGroup: "PPID-1",
    eqp: "ALL",
    sensor: "TEMP",
  }, NOW)

  assert.equal(selfPayload.counts.filteredRows, 0)
  assert.equal(commonPayload.counts.filteredRows, 0)
})
