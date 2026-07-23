import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMyEqpDetailUrl,
  buildSelfEquipmentDetailUrl,
} from "./dashboardLinks.mjs"

test("상세 URL에 라인과 복수 SDWT·Sensor Grade를 반복 쿼리로 보존한다", () => {
  const url = buildSelfEquipmentDetailUrl({
    lineId: "P1",
    sdwts: ["SDWT 1", "SDWT 2", "SDWT 1"],
    sensorGrades: ["A/B", "D", "A/B"],
  })
  const parsed = new URL(url, "http://localhost")

  assert.equal(parsed.pathname, "/self-equipment")
  assert.equal(parsed.searchParams.get("line"), "P1")
  assert.deepEqual(parsed.searchParams.getAll("sdwt"), ["SDWT 1", "SDWT 2"])
  assert.deepEqual(parsed.searchParams.getAll("grade"), ["A/B", "D"])
})

test("My EQP 상세 URL은 기존 Line·SDWT·Grade 구조에서 전용 SDWT 값으로 구분한다", () => {
  const url = buildMyEqpDetailUrl({
    lineId: "P1",
    sensorGrades: ["A", "D"],
    stepToken: "opaque-step-token",
    eqpCh: "EQP-1",
  })
  const parsed = new URL(url, "http://localhost")

  assert.equal(parsed.pathname, "/self-equipment")
  assert.equal(parsed.searchParams.get("line"), "P1")
  assert.deepEqual(parsed.searchParams.getAll("sdwt"), ["MY_EQP"])
  assert.deepEqual(parsed.searchParams.getAll("grade"), ["A", "D"])
  assert.equal(parsed.searchParams.get("step"), "opaque-step-token")
  assert.equal(parsed.searchParams.get("eqpCh"), "EQP-1")
  assert.equal(url.includes("OXIDE ETCH"), false)
})
