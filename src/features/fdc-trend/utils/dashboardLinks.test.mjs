import assert from "node:assert/strict"
import test from "node:test"

import { buildSelfEquipmentDetailUrl } from "./dashboardLinks.mjs"

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
