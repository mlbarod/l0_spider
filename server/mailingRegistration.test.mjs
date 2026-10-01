import assert from "node:assert/strict"
import { Readable } from "node:stream"
import test from "node:test"

import {
  MAILING_PRIORITIES,
  buildMailingDeletePayload,
  buildMailingRecipientPayloads,
  buildMailingRegistrationPayload,
  createMailingHelperError,
  handleMailingRegistrationRequest,
  normalizeMailingRecords,
} from "./mailingRegistration.mjs"

const syntheticMapping = {
  line_mapping: { TEAM_A: "LINE_A", TEAM_B: "LINE_B" },
  sdwt_mapping: { TEAM_A: "DREAMS P1D", TEAM_B: "NAND P1D" },
}

function createResponse() {
  return {
    statusCode: null,
    body: "",
    writeHead(statusCode) {
      this.statusCode = statusCode
    },
    end(body = "") {
      this.body = body
    },
  }
}

test("Mailing 등록 요청은 SDWT와 선택한 Grade를 정규화하고 중복 제거한다", () => {
  const payload = buildMailingRegistrationPayload({
    knoxId: " user01@samsung.com ",
    sdwts: ["DREAMS P1D", " DREAMS P1D ", "NAND P1D"],
    priorities: ["N", " d ", "D"],
  })

  assert.deepEqual(payload, {
    knoxId: "user01",
    knoxIds: ["user01"],
    sdwts: ["DREAMS P1D", "NAND P1D"],
    priorities: ["D", "N"],
  })
})

test("복수 수신인 knox_id를 정규화하고 중복 제거한다", () => {
  const payload = buildMailingRegistrationPayload({
    knoxIds: ["user01", " user02@samsung.com ", "user01"],
    sdwts: ["DREAMS P1D"],
  })

  assert.equal(payload.knoxId, "user01")
  assert.deepEqual(payload.knoxIds, ["user01", "user02"])
})

test("복수 수신인은 DB helper에 전달하기 전에 단건 knox_id payload로 분리한다", () => {
  const payloads = buildMailingRecipientPayloads(buildMailingRegistrationPayload({
    knoxIds: ["user01", "user02"],
    sdwts: ["DREAMS P1D"],
  }))

  assert.deepEqual(payloads, [
    { knoxId: "user01", sdwts: ["DREAMS P1D"], priorities: [...MAILING_PRIORITIES] },
    { knoxId: "user02", sdwts: ["DREAMS P1D"], priorities: [...MAILING_PRIORITIES] },
  ])
  assert.ok(payloads.every((payload) => !Object.hasOwn(payload, "knoxIds")))
})

test("DB 조회 결과를 화면용 등록 조건으로 정규화한다", () => {
  const registrations = normalizeMailingRecords([{
    email: "user01",
    sdwt: ["DREAMS P1D", "DREAMS P1D"],
    priority: ["A", "B"],
  }])

  assert.deepEqual(registrations[0], {
    id: "user01-0",
    knoxId: "user01",
    sdwts: ["DREAMS P1D"],
    priorities: ["A", "B"],
  })
})

test("SDWT 미선택과 잘못된 knox_id는 거부한다", () => {
  assert.throws(
    () => buildMailingRegistrationPayload({ knoxId: "user01", sdwts: [] }),
    /SDWT는 1개 이상/,
  )
  assert.throws(
    () => buildMailingRegistrationPayload({ knoxId: "user 01", sdwts: ["DREAMS P1D"] }),
    /knox_id 형식/,
  )
})

test("Line 삭제 요청은 knox_id와 삭제 대상 SDWT를 정규화한다", () => {
  const payload = buildMailingDeletePayload({
    knoxId: " user01 ",
    line: " P1D ",
    sdwts: ["DREAMS P1D", " DREAMS P1D ", "NAND P1D"],
  })

  assert.equal(payload.knoxId, "user01")
  assert.equal(payload.line, "P1D")
  assert.deepEqual(payload.sdwts, ["DREAMS P1D", "NAND P1D"])
  assert.equal(Object.hasOwn(payload, "priorities"), false)
})

test("Grade 삭제는 지정한 Grade만 전달하고 빈 값·미지원 Grade는 거부한다", () => {
  const body = { knoxId: "user01", line: "LINE_A", sdwts: ["DREAMS P1D"] }
  assert.deepEqual(buildMailingDeletePayload({ ...body, priorities: ["D"] }).priorities, ["D"])
  for (const priorities of [[], ["X"], ["A", "X"], null, "A"]) {
    assert.throws(() => buildMailingRegistrationPayload({ ...body, priorities }), /Grade/)
    assert.throws(() => buildMailingDeletePayload({ ...body, priorities }), /Grade/)
  }
})

test("등록과 Grade 삭제 API는 선택 조건을 그대로 helper에 전달한다", async () => {
  for (const method of ["POST", "DELETE"]) {
    const body = { knoxId: "user01", line: "LINE_A", sdwts: ["DREAMS P1D"], priorities: ["D", "N"] }
    const request = Readable.from([JSON.stringify(body)])
    request.method = method
    const response = createResponse()
    const calls = []
    await handleMailingRegistrationRequest(request, response, undefined, {
      mappingReader: async () => syntheticMapping,
      helperRunner: async (action, payload) => {
        calls.push({ action, payload })
        return { ok: true, affectedRows: 1, requestedRows: 1 }
      },
    })
    assert.equal(response.statusCode, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].action, method === "POST" ? "insert" : "delete_line")
    assert.deepEqual(calls[0].payload.sdwts, body.sdwts)
    assert.deepEqual(calls[0].payload.priorities, body.priorities)
    if (method === "POST") assert.deepEqual(JSON.parse(response.body).registration.priorities, body.priorities)
  }
})

test("Grade 삭제도 Line·SDWT 매핑 검증을 통과하기 전에 DB를 호출하지 않는다", async () => {
  const request = Readable.from([JSON.stringify({
    knoxId: "user01", line: "LINE_B", sdwts: ["DREAMS P1D"], priorities: ["D"],
  })])
  request.method = "DELETE"
  const response = createResponse()
  await handleMailingRegistrationRequest(request, response, undefined, {
    mappingReader: async () => syntheticMapping,
    helperRunner: async () => assert.fail("매핑 불일치 요청은 DB 호출 금지"),
  })
  assert.equal(response.statusCode, 400)
})

test("Grade 삭제 DB 오류는 원인을 구분하되 수신인과 SQL 상세를 응답·예외에 노출하지 않는다", async () => {
  for (const [dbErrorCode, expectedCode, status] of [
    [1062, "MAILING_DB_DUPLICATE_KEY", 409],
    [1406, "MAILING_DB_COLUMN_TOO_SHORT", 500],
    [1364, "MAILING_DB_REQUIRED_COLUMN", 500],
    [9999, "MAILING_REGISTRATION_REQUEST_FAILED", 500],
    [undefined, "MAILING_REGISTRATION_REQUEST_FAILED", 500],
  ]) {
    const helperError = createMailingHelperError({
      ok: false, dbErrorCode,
      error: "secret-recipient@example.test private-host SQL details",
      dbErrorDetail: "secret-recipient@example.test private-host SQL details",
    })
    assert.doesNotMatch(helperError.message, /secret-recipient|private-host|SQL details/)
    const request = Readable.from([JSON.stringify({
      knoxId: "user01", line: "LINE_A", sdwts: ["DREAMS P1D"], priorities: ["D"],
    })])
    request.method = "DELETE"
    const response = createResponse()
    await handleMailingRegistrationRequest(request, response, undefined, {
      mappingReader: async () => syntheticMapping,
      helperRunner: async () => { throw helperError },
    })
    const payload = JSON.parse(response.body)
    assert.equal(response.statusCode, status)
    assert.equal(payload.code, expectedCode)
    assert.deepEqual(Object.keys(payload).sort(), ["code", "error", "ok", "requestId"])
    assert.doesNotMatch(response.body, /secret-recipient|private-host|SQL details|dbErrorDetail/)
  }
})

test("수신인 단독 고유키 사전 검증 실패는 명시적인 409 오류로 반환한다", async () => {
  const request = Readable.from([JSON.stringify({
    knoxId: "user01", line: "LINE_A", sdwts: ["DREAMS P1D"], priorities: ["D"],
  })])
  request.method = "DELETE"
  const response = createResponse()
  await handleMailingRegistrationRequest(request, response, undefined, {
    mappingReader: async () => syntheticMapping,
    helperRunner: async () => { throw createMailingHelperError({ code: "MAILING_DB_SINGLE_ROW_LIMIT" }) },
  })
  assert.equal(response.statusCode, 409)
  assert.equal(JSON.parse(response.body).code, "MAILING_DB_SINGLE_ROW_LIMIT")
  assert.match(JSON.parse(response.body).error, /수신인당 한 행/)
})

test("Mailing 등록 API는 GET, POST, DELETE 외 요청을 거부한다", async () => {
  const response = createResponse()

  await handleMailingRegistrationRequest({ method: "PUT" }, response)

  assert.equal(response.statusCode, 405)
  assert.equal(JSON.parse(response.body).error, "Method not allowed")
})

test("Mailing 등록 실패 응답은 내부 진단정보 없이 문의 코드를 반환한다", async () => {
  const request = Readable.from(["{\"knoxId\":\"secret-user\""])
  request.method = "POST"
  const response = createResponse()

  await handleMailingRegistrationRequest(request, response, undefined, {
    mappingReader: async () => syntheticMapping,
  })

  const payload = JSON.parse(response.body)
  assert.equal(response.statusCode, 500)
  assert.deepEqual(Object.keys(payload).sort(), ["code", "error", "ok", "requestId"])
  assert.equal(payload.code, "MAILING_REGISTRATION_REQUEST_FAILED")
  assert.match(payload.requestId, /^[0-9a-f-]{36}$/)
  assert.doesNotMatch(response.body, /secret-user|debugRow|dbError|sourcePath|\/appdata/)
})

test("mapping을 사용할 수 없으면 Mailing DB 요청 전에 fail-closed한다", async () => {
  const request = Readable.from([])
  request.method = "GET"
  const response = createResponse()

  await handleMailingRegistrationRequest(request, response, new URL("http://localhost/?knoxId=user01"), {
    mappingReader: async () => { throw new Error("synthetic mapping unavailable") },
  })

  const payload = JSON.parse(response.body)
  assert.equal(response.statusCode, 503)
  assert.equal(payload.code, "MAPPING_CONFIG_UNAVAILABLE")
  assert.match(payload.requestId, /^[0-9a-f-]{36}$/)
})

test("mapping 범위 밖 SDWT의 Mailing write를 DB 요청 전에 거부한다", async () => {
  const request = Readable.from([JSON.stringify({ knoxId: "user01", sdwts: ["UNKNOWN_SDWT"] })])
  request.method = "POST"
  const response = createResponse()

  await handleMailingRegistrationRequest(request, response, undefined, {
    mappingReader: async () => syntheticMapping,
  })

  const payload = JSON.parse(response.body)
  assert.equal(response.statusCode, 400)
  assert.equal(payload.code, "MAPPING_SCOPE_MISMATCH")
})
