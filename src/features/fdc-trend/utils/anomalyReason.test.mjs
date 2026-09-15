import assert from "node:assert/strict"
import test from "node:test"

import { buildSelfEquipmentPayload } from "../../../../server/selfEquipmentData.mjs"
import { getAnomalyReasonLabel } from "./anomalyReason.mjs"

test("행별 사유가 차트 응답을 거쳐 지정된 문구로 표시된다", () => {
  const reasons = ["AVG_OUTSIDE_IDENTITY_RANGE", "IDENTITY_DATA_INSUFFICIENT_FALLBACK", "STD_SPEC_OUT"]
  const rows = reasons.map((reason, index) => ({
    line_rev: "P1L", sdwt: "TEAM", priority: "A", desc: "ETCH",
    eqp: "EQP-1", sensor: "TEMP", recipe_id: "R1", step: String(index + 1),
    file_path: `/chart-${index}.png`, reason,
  }))
  const payload = buildSelfEquipmentPayload(rows, {
    line: "P1L", sdwt: "TEAM", priorities: ["A"], desc: "ETCH",
    eqpCh: "ALL", sensor: "ALL", chStep: "ALL",
  })
  assert.deepEqual(payload.rows.map((row) => getAnomalyReasonLabel(row.reason)), [
    "동종설비와 비교하여 진행영역 벗어남",
    "동종설비 모수 부족으로 자설비 기준으로 이상감지",
    "자살비 산포 이상감지",
  ])
})

test("사유가 없거나 코드가 일치하지 않으면 문구를 표시하지 않는다", () => {
  for (const reason of [undefined, null, "", "UNKNOWN", "std_spec_out", "toString", "__proto__"]) {
    assert.equal(getAnomalyReasonLabel(reason), "")
  }
})
