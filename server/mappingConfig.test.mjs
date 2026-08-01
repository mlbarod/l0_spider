import assert from "node:assert/strict"
import test from "node:test"

import {
  MAPPING_CONFIG_UNAVAILABLE_CODE,
  MAPPING_SCOPE_MISMATCH_CODE,
  assertKnownMappingLine,
  assertKnownMappingLineSdwt,
  assertKnownMappingSdwts,
  requireLineMapping,
} from "./mappingConfig.mjs"

const mapping = {
  line_mapping: {
    TEAM_A: "LINE_A",
    TEAM_B: "LINE_B",
    TEAM_WITHOUT_LABEL: "LINE_A",
  },
  sdwt_mapping: {
    TEAM_A: "SDWT_A",
    TEAM_B: "SDWT_B",
  },
}

test("mapping reader 실패와 빈 mapping을 unavailable로 변환한다", async () => {
  await assert.rejects(
    requireLineMapping(async () => { throw new Error("synthetic read failure") }),
    (error) => error.code === MAPPING_CONFIG_UNAVAILABLE_CODE,
  )
  await assert.rejects(
    requireLineMapping(async () => ({ line_mapping: {}, sdwt_mapping: {} })),
    (error) => error.code === MAPPING_CONFIG_UNAVAILABLE_CODE,
  )
})

test("Line과 path SDWT의 mapping 범위를 검증한다", () => {
  assert.doesNotThrow(() => assertKnownMappingLine(mapping, "LINE_A"))
  assert.doesNotThrow(() => assertKnownMappingLineSdwt(mapping, {
    line: "LINE_A",
    pathSdwt: "TEAM_A",
  }))
  assert.throws(
    () => assertKnownMappingLineSdwt(mapping, { line: "LINE_B", pathSdwt: "TEAM_A" }),
    (error) => error.code === MAPPING_SCOPE_MISMATCH_CODE,
  )
})

test("Mailing 표시 SDWT와 label fallback을 mapping 범위로 검증한다", () => {
  assert.doesNotThrow(() => assertKnownMappingSdwts(mapping, {
    line: "LINE_A",
    sdwts: ["SDWT_A", "TEAM_WITHOUT_LABEL"],
  }))
  assert.throws(
    () => assertKnownMappingSdwts(mapping, { line: "LINE_B", sdwts: ["SDWT_A"] }),
    (error) => error.code === MAPPING_SCOPE_MISMATCH_CODE,
  )
})
