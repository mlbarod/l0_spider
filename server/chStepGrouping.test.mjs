import assert from "node:assert/strict"
import test from "node:test"

import { getLowestChStepRowsByPpid } from "../src/features/fdc-trend/utils/chStepGrouping.mjs"

test("ch_step 모아보기는 같은 EQP 안에서 sensor와 PPID별 최저 숫자 step을 유지한다", () => {
  const rows = [
    { id: "a-10", recipe_id: "PPID-A", step: "10@MEAN" },
    { id: "b-7", recipe_id: "PPID-B", step: "7@MEAN" },
    { id: "a-2", recipe_id: "PPID-A", step: "2@MEAN" },
    { id: "b-3", recipe_id: "PPID-B", step: "3@MEAN" },
  ]

  assert.deepEqual(
    getLowestChStepRowsByPpid(rows).map((row) => row.id),
    ["a-2", "b-3"],
  )
})

test("PPID 내 최저 숫자가 같은 ch_step 차트는 모두 유지한다", () => {
  const rows = [
    { id: "first", recipe_id: "PPID-A", step: "2@MEAN" },
    { id: "second", recipe_id: "PPID-A", step: "2@MAX" },
    { id: "hidden", recipe_id: "PPID-A", step: "5@MEAN" },
  ]

  assert.deepEqual(
    getLowestChStepRowsByPpid(rows).map((row) => row.id),
    ["first", "second"],
  )
})

test("Sensor ALL 모아보기는 같은 PPID를 공유하는 각 sensor의 대표 차트를 유지한다", () => {
  const rows = [
    { id: "temp-10", sensor: "TEMP", recipe_id: "PPID-A", step: "10@MEAN" },
    { id: "pressure-20", sensor: "PRESSURE", recipe_id: "PPID-A", step: "20@MEAN" },
    { id: "temp-2", sensor: "TEMP", recipe_id: "PPID-A", step: "2@MEAN" },
    { id: "pressure-5", sensor: "PRESSURE", recipe_id: "PPID-A", step: "5@MEAN" },
  ]

  assert.deepEqual(
    getLowestChStepRowsByPpid(rows).map((row) => row.id),
    ["temp-2", "pressure-5"],
  )
})
