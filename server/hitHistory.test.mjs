import assert from "node:assert/strict"
import test from "node:test"

import { buildHitHistoryRecord, parseHitHistoryPath } from "./hitHistory.mjs"

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

test("동일성 이상감지 img.png 경로를 기존 hit_history 구조로 변환한다", () => {
  const filePath = "/appdata/abnormal_trend/pic/erd_commonality/2026-08-21 08:30:00/SDWT-1/A/10/MAIN ETCH/PPID-1/PPID-1/TEMP_001/img.png"

  assert.deepEqual(buildHitHistoryRecord({
    lineId: "P1L",
    filePath,
    knoxId: "matching-user",
    execDate: "2026-08-21T09:00:00+09:00",
  }), {
    updateDate: "2026-08-21 08:30:00",
    lineId: "P1L",
    sdwt: "SDWT-1",
    filePath: "#appdata#abnormal_trend#pic#erd_commonality#2026-08-21 08:30:00#SDWT-1#A#10#MAIN ETCH#PPID-1#PPID-1#TEMP_001#img.png",
    knoxId: "matching-user",
    execDate: "2026-08-21T09:00:00+09:00",
  })
})

test("공통부 이상감지 EQP 이미지 경로를 기존 hit_history 구조로 변환한다", () => {
  const filePath = "/appdata/abnormal_trend/pic/common/2026-08-21/SDWT-2/ETCH/A/PRESSURE/20/EQP-2.png"

  assert.deepEqual(buildHitHistoryRecord({
    lineId: "P2L",
    filePath,
    knoxId: "common-user",
  }), {
    updateDate: "2026-08-21",
    lineId: "P2L",
    sdwt: "SDWT-2",
    filePath: "#appdata#abnormal_trend#pic#common#2026-08-21#SDWT-2#ETCH#A#PRESSURE#20#EQP-2.png",
    knoxId: "common-user",
    execDate: "",
  })
})

test("공통부 동일성 이상감지 img.png 경로를 기존 hit_history 구조로 변환한다", () => {
  const filePath = "/appdata/abnormal_trend/pic/path_common_commonality/2026-08-21/SDWT-3/MODEL-A/B/FLOW@030/img.png"

  assert.deepEqual(buildHitHistoryRecord({
    lineId: "P3L",
    filePath,
    knoxId: "common-commonality-user",
  }), {
    updateDate: "2026-08-21",
    lineId: "P3L",
    sdwt: "SDWT-3",
    filePath: "#appdata#abnormal_trend#pic#path_common_commonality#2026-08-21#SDWT-3#MODEL-A#B#FLOW@030#img.png",
    knoxId: "common-commonality-user",
    execDate: "",
  })
})

test("허용된 App root 안에서도 결과 이미지 형식이 아니면 거부한다", () => {
  assert.throws(
    () => parseHitHistoryPath("/appdata/abnormal_trend/pic/common/2026-08-21/SDWT-2/ETCH/A/PRESSURE/20/data.parquet"),
    /HIT 이력 정보를 찾지 못했습니다/,
  )
  assert.throws(
    () => parseHitHistoryPath("/tmp/2026-08-21/SDWT-2/result.png"),
    /허용되지 않은 ERD 차트 경로입니다/,
  )
})

test("세 신규 App의 pic_server2 경로를 파싱하고 DB file_path에는 원본을 보존한다", () => {
  const paths = [
    "/appdata/abnormal_trend/pic_server2/erd_commonality/2026-08-21 08:30:00/SDWT-1/A/10/ETCH/PPID/PPID/TEMP_001/img.png",
    "/appdata/abnormal_trend/pic_server2/common/2026-08-21/SDWT-2/ETCH/A/PRESSURE/20/EQP-2.png",
    "/appdata/abnormal_trend/pic_server2/path_common_commonality/2026-08-21/SDWT-3/MODEL-A/B/FLOW@030/img.png",
  ]

  paths.forEach((filePath) => {
    const record = buildHitHistoryRecord({ lineId: "P1L", filePath, knoxId: "user1" })
    assert.match(record.filePath, /#pic_server2#/)
  })
})

test("환경 override root에서도 동일성과 공통부 동일성 경로를 변환한다", () => {
  assert.deepEqual(parseHitHistoryPath(
    "/tmp/synthetic/pic_server2/erd_commonality/2026-08-21 08:30:00/SDWT-1/A/10/ETCH/PPID/PPID/TEMP_001/img.png",
    {
      commonalityRoot: "/tmp/synthetic/pic_server2/erd_commonality",
      commonCommonalityRoot: "/tmp/synthetic/pic_server2/path_common_commonality",
    },
  ), { updateDate: "2026-08-21 08:30:00", sdwt: "SDWT-1" })

  assert.deepEqual(parseHitHistoryPath(
    "/tmp/synthetic/pic/path_common_commonality/2026-08-21/SDWT-3/MODEL-A/B/FLOW@030/img.png",
    {
      commonalityRoot: "/tmp/synthetic/pic_server2/erd_commonality",
      commonCommonalityRoot: "/tmp/synthetic/pic_server2/path_common_commonality",
    },
  ), { updateDate: "2026-08-21", sdwt: "SDWT-3" })
})

test("sibling prefix와 dot segment 경로를 거부한다", () => {
  const invalidPaths = [
    "/appdata/abnormal_trend/pic/erd_commonality_evil/2026-08-21 08:30:00/SDWT-1/A/10/ETCH/PPID/PPID/TEMP_001/img.png",
    "/appdata/abnormal_trend/pic/common/2026-08-21/SDWT-2/ETCH/NOISE/../A/PRESSURE/20/EQP-2.png",
    "/appdata/abnormal_trend/pic/path_common_commonality/../../outside/2026-08-21/SDWT-3/MODEL-A/B/FLOW@030/img.png",
  ]

  invalidPaths.forEach((filePath) => {
    assert.throws(() => parseHitHistoryPath(filePath))
  })
})

test("세 신규 App 경로의 빈 segment를 원문 단계에서 거부한다", () => {
  const invalidPaths = [
    "/appdata/abnormal_trend/pic/erd_commonality/2026-08-21 08:30:00/SDWT-1//A/10/ETCH/PPID/PPID/TEMP_001/img.png",
    "/appdata/abnormal_trend/pic/common/2026-08-21/SDWT-2/ETCH//A/PRESSURE/20/EQP-2.png",
    "/appdata/abnormal_trend/pic/path_common_commonality/2026-08-21/SDWT-3/MODEL-A//B/FLOW@030/img.png",
  ]

  invalidPaths.forEach((filePath) => {
    assert.throws(() => parseHitHistoryPath(filePath), /빈 segment/)
  })
})

test("App별 날짜와 결과 이미지 이름 계약을 검증한다", () => {
  const invalidPaths = [
    "/appdata/abnormal_trend/pic/erd_commonality/not-a-date/SDWT-1/A/10/ETCH/PPID/PPID/TEMP_001/img.png",
    "/appdata/abnormal_trend/pic/erd_commonality/2026-02-30 08:30:00/SDWT-1/A/10/ETCH/PPID/PPID/TEMP_001/img.png",
    "/appdata/abnormal_trend/pic/common/2026-08-21/SDWT-2/ETCH/A/PRESSURE/20/.png",
    "/appdata/abnormal_trend/pic/path_common_commonality/2026-02-30/SDWT-3/MODEL-A/B/FLOW@030/img.png",
    "/appdata/abnormal_trend/pic/path_common_commonality/2026-08-21/SDWT-3/MODEL-A/B/FLOW/img.png",
  ]

  invalidPaths.forEach((filePath) => {
    assert.throws(() => parseHitHistoryPath(filePath), /HIT 이력 정보를 찾지 못했습니다/)
  })
})
