import assert from "node:assert/strict"
import test from "node:test"

import { parquetReadObjects } from "hyparquet"
import { DASHBOARD_DETAIL_COLUMNS } from "./dashboardData.mjs"
import { TEAM_ERD_COLUMNS } from "./selfEquipmentData.mjs"

// 운영 데이터가 아닌 1행짜리 비압축 Parquet: eqp=EQP-TEST, reason=STD_SPEC_OUT.
const LEGACY_FILE = "UEFSMRUAFRgVGCwVAhUAFQYVBgAACAAAAEVRUC1URVNUFQIZLEgGc2NoZW1hFQIAFQwlABgDZXFwJQAAFgIZHBkcJggcFQwZJQAGGRgDZXFwFQAWAhY6FjomCAAAFjoWAgAAQgAAAFBBUjE="
const REASON_FILE = "UEFSMRUAFRgVGCwVAhUAFQYVBgAACAAAAEVRUC1URVNUFQAVIBUgLBUCFQAVBhUGAAAMAAAAU1REX1NQRUNfT1VUFQIZPEgGc2NoZW1hFQQAFQwlABgDZXFwJQAAFQwlABgGcmVhc29uJQAAFgIZHBksJggcFQwZJQAGGRgDZXFwFQAWAhY6FjomCAAAJkIcFQwZJQAGGRgGcmVhc29uFQAWAhZCFkImQgAAFnwWAgAAbwAAAFBBUjE="

function toFile(base64) {
  const bytes = Buffer.from(base64, "base64")
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

test("reason이 있는 Parquet에서 사유와 기존 컬럼을 함께 읽는다", async () => {
  for (const columns of [TEAM_ERD_COLUMNS, DASHBOARD_DETAIL_COLUMNS]) {
    assert.deepEqual(await parquetReadObjects({ file: toFile(REASON_FILE), columns }), [
      { eqp: "EQP-TEST", reason: "STD_SPEC_OUT" },
    ])
  }
})

test("reason 컬럼이 없는 이전 Parquet도 기존 데이터를 읽는다", async () => {
  for (const columns of [TEAM_ERD_COLUMNS, DASHBOARD_DETAIL_COLUMNS]) {
    assert.deepEqual(await parquetReadObjects({ file: toFile(LEGACY_FILE), columns }), [
      { eqp: "EQP-TEST" },
    ])
  }
})
