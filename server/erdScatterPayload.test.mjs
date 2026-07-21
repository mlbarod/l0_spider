import assert from "node:assert/strict"
import test from "node:test"

import { buildErdIdentityPayload, buildErdScatterPayload } from "./selfEquipmentData.mjs"

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

test("동일성 차트의 선택 EQP 원본 데이터는 단일 차트와 동일하다", () => {
  const rows = [
    {
      eqp_cb: "EQP-1",
      eqp_id: "EQP-ID-1",
      act_time: "2026-07-15 13:00:00",
      TEMP_STEP: 1,
    },
    {
      eqp_cb: "EQP-2",
      eqp_id: "EQP-ID-2",
      act_time: "2026-07-15 14:00:00",
      TEMP_STEP: 99,
    },
    {
      eqp_cb: "EQP-1",
      eqp_id: "EQP-ID-1",
      act_time: "2026-07-15 15:00:00",
      TEMP_STEP: 2,
    },
  ]
  const options = {
    eqp: "EQP-1",
    axisColumn: "TEMP_STEP",
    filePath: "/tmp/data.parquet",
  }
  const scatter = buildErdScatterPayload(rows, { ...options, latestDate: "2026-07-15" })
  const identity = buildErdIdentityPayload(rows, options)
  const selectedGroup = identity.groups.find((group) => group.isSelected)

  assert.equal(identity.groups[0], selectedGroup)
  assert.equal(selectedGroup.eqpCb, "EQP-1")
  assert.equal(selectedGroup.pointCount, scatter.pointCount)
  assert.deepEqual(
    selectedGroup.points.map(({ actTime, value, eqpId }) => ({ actTime, value, eqpId })),
    scatter.points.map(({ actTime, value, eqpId }) => ({ actTime, value, eqpId })),
  )
})

test("동일성 차트 기간을 지정하면 전체 데이터의 최신 act_time 기준 최근 N일만 반환한다", () => {
  const rows = [
    { eqp_cb: "EQP-1", act_time: "2026-07-10 11:59:59", TEMP_STEP: 1 },
    { eqp_cb: "EQP-1", act_time: "2026-07-10 12:00:00", TEMP_STEP: 2 },
    { eqp_cb: "EQP-2", act_time: "2026-07-13 12:00:00", TEMP_STEP: 3 },
  ]

  const payload = buildErdIdentityPayload(rows, {
    eqp: "EQP-1",
    axisColumn: "TEMP_STEP",
    filePath: "/tmp/data.parquet",
    windowDays: 3,
  })

  assert.equal(payload.windowDays, 3)
  assert.equal(payload.mostRecentActTimeMs, Date.UTC(2026, 6, 13, 12))
  assert.equal(payload.windowStartMs, Date.UTC(2026, 6, 10, 12))
  assert.equal(payload.sourcePointCount, 2)
  assert.equal(payload.pointCount, 2)
  assert.deepEqual(
    payload.groups.flatMap((group) => group.points.map((point) => point.actTime)),
    ["2026-07-10 12:00:00", "2026-07-13 12:00:00"],
  )
})

test("기간 동일성 응답은 EQP별 포인트를 샘플링해 차트 전송량을 제한한다", () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    eqp_cb: "EQP-1",
    act_time: `2026-07-13 12:${String(Math.floor(index / 60) % 60).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}`,
    TEMP_STEP: index,
  }))

  const payload = buildErdIdentityPayload(rows, {
    eqp: "EQP-1",
    axisColumn: "TEMP_STEP",
    filePath: "/tmp/data.parquet",
    windowDays: 3,
  })

  assert.equal(payload.sourcePointCount, 1000)
  assert.equal(payload.pointCount, 800)
  assert.equal(payload.groups[0].sourcePointCount, 1000)
  assert.equal(payload.groups[0].points[0].value, 0)
  assert.equal(payload.groups[0].points.at(-1).value, 999)
})
