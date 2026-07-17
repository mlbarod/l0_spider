import assert from "node:assert/strict"
import test from "node:test"

import {
  COMMON_PASS_HISTORY_VERSION,
  buildPassHistoryFilterPayload,
  parseCommonPassHistoryPath,
} from "./passHistory.mjs"

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
