import assert from "node:assert/strict"
import test from "node:test"

import { createSafeApiError } from "./safeApiError.mjs"

test("안전한 API 오류는 고정 메시지와 추적 가능한 문의 코드만 반환한다", () => {
  const logs = []
  const payload = createSafeApiError({
    code: "SYNTHETIC_REQUEST_FAILED",
    message: "요청을 처리하지 못했습니다.",
    scope: "synthetic-test",
    logger: (message) => logs.push(message),
  })

  assert.deepEqual(Object.keys(payload).sort(), ["code", "error", "ok", "requestId"])
  assert.equal(payload.ok, false)
  assert.equal(payload.code, "SYNTHETIC_REQUEST_FAILED")
  assert.equal(payload.error, "요청을 처리하지 못했습니다.")
  assert.match(payload.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(logs.length, 1)
  assert.match(logs[0], new RegExp(`code=SYNTHETIC_REQUEST_FAILED requestId=${payload.requestId}$`))
})

test("안전하지 않은 code와 scope는 거부한다", () => {
  assert.throws(
    () => createSafeApiError({ code: "bad-code", message: "실패", scope: "synthetic-test" }),
    /code 형식/,
  )
  assert.throws(
    () => createSafeApiError({ code: "SAFE_CODE", message: "실패", scope: "../secret" }),
    /scope 형식/,
  )
})
