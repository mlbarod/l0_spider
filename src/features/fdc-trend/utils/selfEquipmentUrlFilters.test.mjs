import assert from "node:assert/strict"
import test from "node:test"

import {
  readSelfEquipmentUrlFilters,
  resolveSelfEquipmentGrades,
  resolveSelfEquipmentTeam,
} from "./selfEquipmentUrlFilters.mjs"

test("자설비 URL에서 Line과 반복 SDWT·Grade 조건을 읽는다", () => {
  const params = new URLSearchParams(
    "line=P1&sdwt=SDWT+1&sdwt=SDWT+2&grade=A&grade=D&grade=A",
  )

  assert.deepEqual(readSelfEquipmentUrlFilters(params), {
    line: "P1",
    sdwts: ["SDWT 1", "SDWT 2"],
    grades: ["A", "D"],
  })
})

test("SDWT URL 값은 내부 키와 화면 표시명 모두 대소문자 구분 없이 매칭한다", () => {
  const teams = [
    { key: "S1", label: "DREAMS P1D" },
    { key: "S2", label: "NAND P1D" },
  ]

  assert.equal(resolveSelfEquipmentTeam(teams, ["dreams p1d"]), "S1")
  assert.equal(resolveSelfEquipmentTeam(teams, ["s2"]), "S2")
  assert.equal(resolveSelfEquipmentTeam(teams, ["missing"]), "")
})

test("개별 A·B URL Grade는 화면의 A/B 필터로 합치고 유효한 조건만 선택한다", () => {
  const options = ["A/B", "D", "N", "M"]

  assert.deepEqual(resolveSelfEquipmentGrades(["B", "D", "X"], options), ["A/B", "D"])
  assert.deepEqual(resolveSelfEquipmentGrades(["a/b"], options), ["A/B"])
})
