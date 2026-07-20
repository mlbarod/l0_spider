import assert from "node:assert/strict"
import test from "node:test"

import {
  buildSdwtLineLookup,
  expandMailingRegistrationRows,
} from "./mailingRegistration.mjs"

const lineMapping = { TEAM_A: "P1D", TEAM_B: "P2D" }
const sdwtMapping = { TEAM_A: "DREAMS P1D", TEAM_B: "NAND P2D" }

test("내부 SDWT key와 표시명 모두 Line으로 변환한다", () => {
  const lookup = buildSdwtLineLookup(lineMapping, sdwtMapping)

  assert.equal(lookup.get("TEAM_A"), "P1D")
  assert.equal(lookup.get("DREAMS P1D"), "P1D")
})

test("등록 조건을 Line, SDWT, Grade별 행과 단일 조건 URL로 펼친다", () => {
  const rows = expandMailingRegistrationRows([{
    knoxId: "user01",
    sdwts: ["DREAMS P1D", "NAND P2D"],
    priorities: ["A", "B"],
  }], lineMapping, sdwtMapping)

  assert.equal(rows.length, 4)
  const row = rows.find((item) => item.line === "P1D" && item.grade === "A")
  const url = new URL(row.url, "http://localhost")
  assert.equal(url.searchParams.get("line"), "P1D")
  assert.deepEqual(url.searchParams.getAll("sdwt"), ["DREAMS P1D"])
  assert.deepEqual(url.searchParams.getAll("grade"), ["A"])
})

test("같은 조건이 여러 DB 행에 있어도 표시 행은 중복되지 않는다", () => {
  const registration = {
    knoxId: "user01",
    sdwts: ["DREAMS P1D"],
    priorities: ["A"],
  }
  const rows = expandMailingRegistrationRows(
    [registration, { ...registration }],
    lineMapping,
    sdwtMapping,
  )

  assert.equal(rows.length, 1)
})
