import assert from "node:assert/strict"
import test from "node:test"

import {
  handleMyEqpReferenceRequest,
  normalizeMyEqpReferenceRows,
  referenceLookupErrorMessage,
} from "./myEqpReference.mjs"

test("DB 오류는 알려진 번호만 안전한 안내로 변환한다", () => {
  assert.match(referenceLookupErrorMessage(1054), /컬럼.*DB 1054/)
  assert.match(referenceLookupErrorMessage(1142), /SELECT 권한/)
  assert.match(referenceLookupErrorMessage(1267), /collation/)
  assert.match(referenceLookupErrorMessage(1271), /UNION/)
  for (const value of [null, undefined, "secret connection details", 9999]) {
    assert.equal(referenceLookupErrorMessage(value), "My EQP 기준정보를 불러오지 못했습니다.")
  }
})

test("erdtsum_info 응답은 허용된 네 컬럼만 노출한다", () => {
  const rows = normalizeMyEqpReferenceRows([{
    main: " EQP01 ",
    disp_name: " A ",
    sdwt_prod: " SDWT-1 ",
    prc_group: " ETCH ",
    forbidden_column: "노출 금지",
  }])

  assert.deepEqual(rows, [{
    main: "EQP01",
    disp_name: "A",
    sdwt_prod: "SDWT-1",
    prc_group: "ETCH",
  }])
})

test("필수 기준정보가 비어 있는 행은 필터링한다", () => {
  const rows = normalizeMyEqpReferenceRows([
    { main: "", disp_name: "A", sdwt_prod: "S", prc_group: "P" },
    { main: "M", disp_name: null, sdwt_prod: "S", prc_group: "P" },
  ])

  assert.deepEqual(rows, [])
})

test("My EQP 기준정보 API는 쓰기 요청을 거부한다", async () => {
  const response = {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode
      this.headers = headers
    },
    end(body = "") {
      this.body = body
    },
  }

  await handleMyEqpReferenceRequest({ method: "POST" }, response)

  assert.equal(response.statusCode, 405)
  assert.equal(response.headers.Allow, "GET, HEAD")
  assert.equal(JSON.parse(response.body).error, "Method not allowed")
})
