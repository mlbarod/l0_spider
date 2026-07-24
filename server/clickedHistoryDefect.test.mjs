import assert from "node:assert/strict"
import test from "node:test"

import { buildClickedHistoryDefectRecord } from "./clickedHistoryDefect.mjs"

test("MY EQP 선택 이력을 clicked_history_defect의 4개 값으로 생성한다", () => {
  assert.deepEqual(buildClickedHistoryDefectRecord({
    lineName: "P1L",
    selectStep: "MY EQP",
    clickedAt: "2026-07-24T09:30:00+09:00",
    knoxId: "user1",
  }), {
    lineName: "P1L",
    selectStep: "MY EQP",
    updateDate: "2026-07-24T09:30:00+09:00",
    knoxId: "user1",
  })
})

test("기존 Defect Spider 규칙대로 첫 밑줄 앞까지만 select_step으로 사용한다", () => {
  const record = buildClickedHistoryDefectRecord({
    lineName: "P1L",
    selectStep: "MAIN_ETCH",
    knoxId: "user1",
  })
  assert.equal(record.selectStep, "MAIN")
})
