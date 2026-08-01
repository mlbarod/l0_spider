import assert from "node:assert/strict"
import test from "node:test"

import {
  isLineMappingQueryReady,
  validateLineMappingPayload,
} from "./mappingContract.mjs"

const validMapping = {
  line_mapping: { TEAM_A: "LINE_A" },
  sdwt_mapping: { TEAM_A: "SDWT_A" },
}

test("유효한 mapping payload를 정규화한다", () => {
  assert.deepEqual(validateLineMappingPayload(validMapping), validMapping)
  assert.deepEqual(validateLineMappingPayload({ root: validMapping }), validMapping)
})

test("빈 line mapping과 잘못된 dictionary 항목을 거부한다", () => {
  assert.throws(
    () => validateLineMappingPayload({ line_mapping: {}, sdwt_mapping: {} }),
    /line_mapping이 비어 있습니다/,
  )
  assert.throws(
    () => validateLineMappingPayload({ line_mapping: [], sdwt_mapping: {} }),
    /line_mapping 형식/,
  )
  assert.throws(
    () => validateLineMappingPayload({ line_mapping: { TEAM_A: "" }, sdwt_mapping: {} }),
    /line_mapping 항목/,
  )
  assert.throws(
    () => validateLineMappingPayload({ line_mapping: { TEAM_A: "LINE_A" }, sdwt_mapping: null }),
    /sdwt_mapping 형식/,
  )
})

test("query가 성공하고 mapping 계약이 유효할 때만 ready로 판정한다", () => {
  assert.equal(isLineMappingQueryReady({ isSuccess: true, isError: false, data: validMapping }), true)
  assert.equal(isLineMappingQueryReady({ isSuccess: false, isError: false, data: validMapping }), false)
  assert.equal(isLineMappingQueryReady({ isSuccess: true, isError: true, data: validMapping }), false)
  assert.equal(isLineMappingQueryReady({
    isSuccess: true,
    isError: false,
    data: { line_mapping: {}, sdwt_mapping: {} },
  }), false)
})
