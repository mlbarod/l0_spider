import assert from "node:assert/strict"
import test from "node:test"

import { buildHitHistoryRecord } from "./hitHistory.mjs"

test("Chart 경로를 hit_history 컬럼 값으로 변환한다", () => {
  const filePath = "/appdata/abnormal_trend/pic/erd/2026-07-16 12:30:00/SDWT-1/MAIN ETCH/V1/PPID-1/A/TEMP/10@001/EQP-1.png"
  assert.deepEqual(buildHitHistoryRecord({
    lineId: "P1L",
    filePath,
    knoxId: "user1",
    execDate: "2026-07-16T13:00:00+09:00",
  }), {
    updateDate: "2026-07-16 12:30:00",
    lineId: "P1L",
    sdwt: "SDWT-1",
    filePath: "#appdata#abnormal_trend#pic#erd#2026-07-16 12:30:00#SDWT-1#MAIN ETCH#V1#PPID-1#A#TEMP#10@001#EQP-1.png",
    knoxId: "user1",
    execDate: "2026-07-16T13:00:00+09:00",
  })
})

test("pic_server2 경로는 파싱하되 file_path에는 원본 경로를 보존한다", () => {
  const record = buildHitHistoryRecord({
    lineId: "P2L",
    filePath: "/appdata/abnormal_trend/pic_server2/erd/2026-07-17/SDWT-2/ETCH/V2/PPID-2/B/PRESSURE/20@001/EQP-2.png",
    knoxId: "user2",
  })

  assert.equal(record.updateDate, "2026-07-17")
  assert.equal(record.sdwt, "SDWT-2")
  assert.equal(
    record.filePath,
    "#appdata#abnormal_trend#pic_server2#erd#2026-07-17#SDWT-2#ETCH#V2#PPID-2#B#PRESSURE#20@001#EQP-2.png",
  )
})
