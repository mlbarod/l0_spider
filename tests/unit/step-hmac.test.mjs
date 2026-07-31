import assert from "node:assert/strict"
import test from "node:test"

import { buildMyEqpDetailUrl } from "../../src/features/fdc-trend/utils/dashboardLinks.mjs"
import {
  MY_EQP_URL_SDWT,
  MY_EQP_URL_STEP,
  readSelfEquipmentUrlFilters,
} from "../../src/features/fdc-trend/utils/selfEquipmentUrlFilters.mjs"

test("MY EQP 링크의 step은 HMAC token이 아닌 ALL 예약값이다", () => {
  const builtUrl = buildMyEqpDetailUrl({
    lineId: "SYNTH_LINE",
    sensorGrades: ["D"],
    eqpCh: "SYNTH_EQP_01",
  })
  const parsedUrl = new URL(builtUrl, "http://localhost")
  const filters = readSelfEquipmentUrlFilters(parsedUrl.searchParams)

  assert.equal(parsedUrl.searchParams.get("step"), MY_EQP_URL_STEP)
  assert.equal(filters.stepToken, MY_EQP_URL_STEP)
  assert.deepEqual(filters.sdwts, [MY_EQP_URL_SDWT])
})

test("MY EQP는 누락·임의 step 값을 HMAC으로 검증하지 않고 ALL 분기를 유지한다", () => {
  const missingStep = readSelfEquipmentUrlFilters(
    new URLSearchParams("line=SYNTH_LINE&sdwt=MY_EQP&grade=D"),
  )
  const opaqueStep = readSelfEquipmentUrlFilters(
    new URLSearchParams("line=SYNTH_LINE&sdwt=MY_EQP&grade=D&step=synthetic-opaque-token"),
  )

  assert.equal(missingStep.stepToken, MY_EQP_URL_STEP)
  assert.equal(opaqueStep.stepToken, MY_EQP_URL_STEP)
})

test("비 MY EQP의 opaque step과 eqpCh는 URLSearchParams round trip 후 보존된다", () => {
  const stepValue = "synthetic-token+/=% 한글"
  const eqpChValue = "SYNTH EQP/+ 01"
  const sourceUrl = new URL("/self-equipment", "http://localhost")
  sourceUrl.searchParams.set("line", "SYNTH_LINE")
  sourceUrl.searchParams.set("sdwt", "SYNTH_SDWT")
  sourceUrl.searchParams.set("grade", "D")
  sourceUrl.searchParams.set("step", stepValue)
  sourceUrl.searchParams.set("eqpCh", eqpChValue)

  const roundTrippedUrl = new URL(sourceUrl.href)
  const filters = readSelfEquipmentUrlFilters(roundTrippedUrl.searchParams)

  assert.equal(filters.stepToken, stepValue)
  assert.equal(filters.eqpCh, eqpChValue)
})

test("eqpCh는 legacy eqp_ch보다 우선하며 누락 시 alias를 사용한다", () => {
  const primary = readSelfEquipmentUrlFilters(
    new URLSearchParams("eqpCh=SYNTH_PRIMARY&eqp_ch=SYNTH_LEGACY"),
  )
  const legacy = readSelfEquipmentUrlFilters(
    new URLSearchParams("eqp_ch=SYNTH_LEGACY"),
  )

  assert.equal(primary.eqpCh, "SYNTH_PRIMARY")
  assert.equal(legacy.eqpCh, "SYNTH_LEGACY")
})
