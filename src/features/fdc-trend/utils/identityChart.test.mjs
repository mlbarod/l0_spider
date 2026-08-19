import assert from "node:assert/strict"
import test from "node:test"

import {
  buildRenderedScatterSeries,
  buildIdentityChartPoints,
  ERD_SCATTER_SERIES_DATA_KEYS,
  selectRenderedIdentityPoints,
} from "./identityChart.mjs"

function createPoint(index, value = index) {
  return {
    actTimeMs: Date.UTC(2026, 6, 1) + index * 60 * 1000,
    value,
  }
}

test("단일 scatter의 이전·최근 series는 tooltip이 구분할 수 있는 dataKey를 사용한다", () => {
  const previousPoint = {
    ...createPoint(0, 10),
    isRecent: false,
    waferId: "WAFER-PREVIOUS",
  }
  const recentPoint = {
    ...createPoint(1, 20),
    isRecent: true,
    waferId: "WAFER-RECENT",
  }
  const rendered = buildRenderedScatterSeries([previousPoint, recentPoint], null)

  assert.notEqual(
    ERD_SCATTER_SERIES_DATA_KEYS.previous,
    ERD_SCATTER_SERIES_DATA_KEYS.recent,
  )
  assert.deepEqual(rendered.previous, [{
    ...previousPoint,
    [ERD_SCATTER_SERIES_DATA_KEYS.previous]: previousPoint.value,
  }])
  assert.deepEqual(rendered.recent, [{
    ...recentPoint,
    [ERD_SCATTER_SERIES_DATA_KEYS.recent]: recentPoint.value,
  }])
  assert.equal(rendered.recent[0].waferId, "WAFER-RECENT")
  assert.equal(ERD_SCATTER_SERIES_DATA_KEYS.previous in rendered.recent[0], false)
})

test("동일성 포인트는 자기 EQP 구간의 경계 안쪽에 배치한다", () => {
  const groups = [
    { eqpCb: "EQP-1", isSelected: true, points: [createPoint(0), createPoint(10)] },
    { eqpCb: "EQP-2", isSelected: false, points: [createPoint(0), createPoint(10)] },
  ]
  const points = buildIdentityChartPoints(groups)

  assert.ok(points[0].identityX > 0 && points[0].identityX < 1)
  assert.ok(points[1].identityX > 0 && points[1].identityX < 1)
  assert.ok(points[2].identityX > 1 && points[2].identityX < 2)
  assert.ok(points[3].identityX > 1 && points[3].identityX < 2)
  assert.deepEqual(points.map((point) => point.eqpCb), ["EQP-1", "EQP-1", "EQP-2", "EQP-2"])
})

test("선택 EQP는 단일 차트와 동일하게 이전·최근 데이터를 각각 최대 800개 표시한다", () => {
  const points = Array.from({ length: 2000 }, (_, index) => createPoint(index))
  const groups = [{ eqpCb: "EQP-1", isSelected: true, points }]
  const identityPoints = buildIdentityChartPoints(groups)
  const rendered = selectRenderedIdentityPoints(groups, identityPoints, null)

  const recentCount = identityPoints.filter((point) => point.isRecent).length
  const previousCount = identityPoints.length - recentCount
  assert.equal(
    rendered.selected.length,
    Math.min(previousCount, 800) + Math.min(recentCount, 800),
  )
  assert.equal(rendered.others.length, 0)
  assert.deepEqual(rendered.points, rendered.selected)
})
