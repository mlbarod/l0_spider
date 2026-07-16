import assert from "node:assert/strict"
import test from "node:test"

import { buildErdScatterPayload } from "./selfEquipmentData.mjs"

test("각 차트의 가장 최신 act_time에서 과거 26시간까지 recent로 표시한다", () => {
  const payload = buildErdScatterPayload([
    {
      eqp_cb: "EQP-1",
      act_time: "2026-07-14 12:59:59",
      TEMP_STEP: 1,
    },
    {
      eqp_cb: "EQP-1",
      act_time: "2026-07-14 13:00:00",
      TEMP_STEP: 2,
    },
    {
      eqp_cb: "EQP-1",
      act_time: "2026-07-15 15:00:00",
      TEMP_STEP: 3,
    },
    {
      eqp_cb: "EQP-2",
      act_time: "2026-07-16 23:00:00",
      TEMP_STEP: 4,
    },
  ], {
    eqp: "EQP-1",
    axisColumn: "TEMP_STEP",
    filePath: "/tmp/data.parquet",
    latestDate: "2026-08-01",
  })

  assert.equal(payload.mostRecentActTimeMs, Date.UTC(2026, 6, 15, 15))
  assert.equal(payload.recentThresholdMs, Date.UTC(2026, 6, 14, 13))
  assert.deepEqual(payload.points.map((point) => point.isRecent), [false, true, true])
})
