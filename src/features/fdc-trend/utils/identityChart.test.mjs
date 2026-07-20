import assert from "node:assert/strict"
import test from "node:test"

import {
  buildIdentityChartPoints,
  selectRenderedIdentityPoints,
} from "./identityChart.mjs"

function createPoint(index, value = index) {
  return {
    actTimeMs: Date.UTC(2026, 6, 1) + index * 60 * 1000,
    value,
  }
}

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
