import assert from "node:assert/strict"
import test from "node:test"

import { fetchLineMapping } from "./mappingConfigApi.js"

function withFetchResponse(payload, { ok = true } = {}) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok,
    json: async () => payload,
  })
  return () => { globalThis.fetch = originalFetch }
}

test("mapping API 성공 payload가 최소 계약을 만족하면 반환한다", async () => {
  const restore = withFetchResponse({
    line_mapping: { TEAM_A: "LINE_A" },
    sdwt_mapping: { TEAM_A: "SDWT_A" },
  })
  try {
    const result = await fetchLineMapping()
    assert.equal(result.line_mapping.TEAM_A, "LINE_A")
  } finally {
    restore()
  }
})

test("mapping API의 빈 success payload를 오류로 처리한다", async () => {
  const restore = withFetchResponse({ line_mapping: {}, sdwt_mapping: {} })
  try {
    await assert.rejects(fetchLineMapping(), /line_mapping이 비어 있습니다/)
  } finally {
    restore()
  }
})
