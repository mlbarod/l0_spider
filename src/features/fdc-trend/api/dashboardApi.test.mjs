import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { fetchDashboardSummary } from "./dashboardApi.js"

const successFixture = JSON.parse(readFileSync(
  new URL("../../../../harness/fixtures/dashboard/dashboard-success.json", import.meta.url),
  "utf8",
))

function cloneFixture() {
  return JSON.parse(JSON.stringify(successFixture))
}

async function withMockFetch(payload, callback) {
  const originalFetch = globalThis.fetch
  let requestedUrl = ""
  globalThis.fetch = async (url) => {
    requestedUrl = url
    return {
      ok: true,
      json: async () => payload,
    }
  }
  try {
    await callback(() => requestedUrl)
  } finally {
    globalThis.fetch = originalFetch
  }
}

test("Dashboard API client returns an integrity-checked success payload", async () => {
  await withMockFetch(cloneFixture(), async (getRequestedUrl) => {
    const payload = await fetchDashboardSummary()
    assert.equal(payload.lineDashboard.summary.totalAbnormalCount, 1)
    assert.equal(getRequestedUrl(), "/api/dashboard-data")
  })
})

test("Dashboard API client rejects a summary/detail mismatch", async () => {
  const payload = cloneFixture()
  payload.lineDashboard.summary.totalAbnormalCount = 2

  await withMockFetch(payload, async () => {
    await assert.rejects(
      fetchDashboardSummary(),
      /대시보드 응답 데이터 정합성 오류/,
    )
  })
})

test("Dashboard API client rejects a Line outside the requested scope", async () => {
  const payload = cloneFixture()
  payload.lineDashboard.filters.lines = ["TEST_LINE"]
  payload.lineDashboard.mailingSummary[0].lineId = "OTHER_LINE"

  await withMockFetch(payload, async (getRequestedUrl) => {
    await assert.rejects(
      fetchDashboardSummary({ lines: ["TEST_LINE"] }),
      /대시보드 응답 데이터 정합성 오류/,
    )
    assert.equal(getRequestedUrl(), "/api/dashboard-data?line=TEST_LINE")
  })
})
