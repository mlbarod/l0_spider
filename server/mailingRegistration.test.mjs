import assert from "node:assert/strict"
import test from "node:test"

import {
  MAILING_PRIORITIES,
  buildMailingDeletePayload,
  buildMailingDebugRow,
  buildMailingRecipientPayloads,
  buildMailingRegistrationPayload,
  handleMailingRegistrationRequest,
  normalizeMailingRecords,
} from "./mailingRegistration.mjs"

test("Mailing 등록 요청은 SDWT를 중복 제거하고 priority를 고정한다", () => {
  const payload = buildMailingRegistrationPayload({
    knoxId: " user01@samsung.com ",
    sdwts: ["DREAMS P1D", " DREAMS P1D ", "NAND P1D"],
    priorities: ["X"],
  })

  assert.deepEqual(payload, {
    knoxId: "user01",
    knoxIds: ["user01"],
    sdwts: ["DREAMS P1D", "NAND P1D"],
    priorities: [...MAILING_PRIORITIES],
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

test("VARCHAR 컬럼에 저장할 복수 값을 JSON 배열 문자열로 만든다", () => {
  const row = buildMailingDebugRow({
    knoxId: "user01",
    sdwts: ["DREAMS P1D", "NAND P1D"],
    priorities: [...MAILING_PRIORITIES],
  })

  assert.deepEqual(JSON.parse(row.sdwt), ["DREAMS P1D", "NAND P1D"])
  assert.deepEqual(JSON.parse(row.priority), ["A", "B", "D", "M", "N"])
  assert.equal(row.email, "user01")
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
})

test("Mailing 등록 API는 GET, POST, DELETE 외 요청을 거부한다", async () => {
  const response = {
    statusCode: null,
    body: "",
    writeHead(statusCode) {
      this.statusCode = statusCode
    },
    end(body = "") {
      this.body = body
    },
  }

  await handleMailingRegistrationRequest({ method: "PUT" }, response)

  assert.equal(response.statusCode, 405)
  assert.equal(JSON.parse(response.body).error, "Method not allowed")
})
