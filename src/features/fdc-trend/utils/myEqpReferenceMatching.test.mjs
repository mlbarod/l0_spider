import assert from "node:assert/strict"
import test from "node:test"

import { filterMyEqpReferenceRowsBySdwt } from "./myEqpReferenceMatching.mjs"

test("My EQP SDWT 기준정보는 대소문자가 달라도 매칭한다", () => {
  const rows = [
    { sdwt_prod: "dreams p1d", prc_group: "ETCH" },
    { sdwt_prod: "NAND P1D", prc_group: "CVD" },
  ]

  assert.deepEqual(
    filterMyEqpReferenceRowsBySdwt(rows, ["DREAMS P1D"]),
    [rows[0]],
  )
})

test("My EQP SDWT 기준정보 비교 시 앞뒤 공백과 Unicode 표기 차이를 정규화한다", () => {
  const rows = [{ sdwt_prod: "  ＤＲＥＡＭＳ P1D  ", prc_group: "ETCH" }]

  assert.deepEqual(
    filterMyEqpReferenceRowsBySdwt(rows, ["DREAMS P1D"]),
    rows,
  )
})
