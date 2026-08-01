import assert from "node:assert/strict"
import test from "node:test"

import {
  createDashboardQueryOptions,
  createDashboardTrendQueryOptions,
} from "./dashboardQueryOptions.mjs"

test("Line filter key changes do not retain a previous Dashboard payload", () => {
  const first = createDashboardQueryOptions({ lines: ["LINE_A"] })
  const second = createDashboardQueryOptions({ lines: ["LINE_B"] })

  assert.notDeepEqual(first.queryKey, second.queryKey)
  assert.equal(Object.hasOwn(first, "placeholderData"), false)
  assert.equal(Object.hasOwn(second, "placeholderData"), false)
})

test("trend period key changes do not retain a previous trend payload", () => {
  const filters = {
    startDate: "2000-01-01",
    endDate: "2000-01-10",
    lines: ["TEST_LINE"],
  }
  const first = createDashboardTrendQueryOptions(10, filters)
  const second = createDashboardTrendQueryOptions(30, {
    ...filters,
    startDate: "1999-12-12",
  })

  assert.notDeepEqual(first.queryKey, second.queryKey)
  assert.equal(Object.hasOwn(first, "placeholderData"), false)
  assert.equal(Object.hasOwn(second, "placeholderData"), false)
})
