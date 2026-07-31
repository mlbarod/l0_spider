import assert from "node:assert/strict"
import test from "node:test"

import { CHARTS_PER_PAGE, paginateChartGroups } from "./chartPagination.mjs"

function createGroup(eqp, rowCount) {
  const visibleRows = Array.from({ length: rowCount }, (_, index) => ({
    id: `${eqp}-${index + 1}`,
  }))
  return {
    eqp,
    rows: visibleRows,
    visibleRows,
  }
}

test("표시 차트를 EQP 순서대로 페이지당 20개로 제한한다", () => {
  const result = paginateChartGroups([
    createGroup("EQP-1", 12),
    createGroup("EQP-2", 15),
  ], 1)

  assert.equal(result.totalCharts, 27)
  assert.equal(result.totalPages, 2)
  assert.equal(result.pageGroups[0].visibleRows.length, 12)
  assert.equal(result.pageGroups[1].visibleRows.length, 8)
  assert.equal(
    result.pageGroups.flatMap((group) => group.visibleRows).length,
    CHARTS_PER_PAGE,
  )
})

test("다음 페이지는 앞 페이지에 그리지 않은 차트부터 반환한다", () => {
  const result = paginateChartGroups([
    createGroup("EQP-1", 12),
    createGroup("EQP-2", 15),
  ], 2)

  assert.equal(result.page, 2)
  assert.deepEqual(
    result.pageGroups.flatMap((group) => group.visibleRows.map((row) => row.id)),
    ["EQP-2-9", "EQP-2-10", "EQP-2-11", "EQP-2-12", "EQP-2-13", "EQP-2-14", "EQP-2-15"],
  )
})

test("범위를 벗어난 페이지 번호는 마지막 페이지로 보정한다", () => {
  const result = paginateChartGroups([createGroup("EQP-1", 21)], 99)

  assert.equal(result.page, 2)
  assert.equal(result.pageGroups[0].visibleRows[0].id, "EQP-1-21")
})

test("동일성 비교 차트를 함께 그릴 때도 실제 차트 수를 페이지당 20개로 제한한다", () => {
  const group = {
    ...createGroup("EQP-1", 11),
    chartsPerRow: 2,
  }
  const firstPage = paginateChartGroups([group], 1)
  const secondPage = paginateChartGroups([group], 2)

  assert.equal(firstPage.totalCharts, 22)
  assert.equal(firstPage.totalPages, 2)
  assert.equal(firstPage.pageGroups[0].visibleRows.length, 10)
  assert.equal(secondPage.pageGroups[0].visibleRows.length, 1)
})
