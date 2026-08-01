import assert from "node:assert/strict"
import test from "node:test"

import { getApiErrorMessage, sanitizeErrorMessage } from "./errorMessage.js"

test("오류 메시지의 Unix 및 Windows 절대 파일 경로를 숨긴다", () => {
  assert.equal(
    sanitizeErrorMessage("ENOENT: stat '/appdata/abnormal_trend/pic/erd/data.parquet'"),
    "ENOENT: stat [파일 경로 숨김]",
  )
  assert.equal(
    sanitizeErrorMessage("읽기 실패 C:\\data\\erd\\data.parquet"),
    "읽기 실패 [파일 경로 숨김]",
  )
  assert.equal(
    sanitizeErrorMessage("Traceback: scripts/pass_history.py 파일 처리 실패"),
    "Traceback: [파일 경로 숨김] 파일 처리 실패",
  )
})

test("경로가 없는 오류 메시지와 fallback은 그대로 사용한다", () => {
  assert.equal(sanitizeErrorMessage("조회 조건이 올바르지 않습니다."), "조회 조건이 올바르지 않습니다.")
  assert.equal(getApiErrorMessage({}, "데이터를 불러오지 못했습니다."), "데이터를 불러오지 못했습니다.")
})

test("안전한 문의 코드는 오류 메시지에 표시하고 잘못된 값은 무시한다", () => {
  assert.equal(
    getApiErrorMessage({ error: "조회 실패", requestId: "123e4567-e89b-12d3-a456-426614174000" }),
    "조회 실패 [문의 코드: 123e4567-e89b-12d3-a456-426614174000]",
  )
  assert.equal(
    getApiErrorMessage({ error: "조회 실패", requestId: "../../secret" }),
    "조회 실패",
  )
})
