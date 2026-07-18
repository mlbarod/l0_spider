import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMyEqpRegistrationPayload,
  handleMyEqpRegistrationRequest,
  resolveRegistrationUserId,
} from "./myEqpRegistration.mjs"

test("My EQP 등록 요청을 DB 컬럼용 값으로 정규화한다", () => {
  const payload = buildMyEqpRegistrationPayload({
    line: " P1D ",
    sdwt: " DREAMS P1D ",
    prcGroup: " OXIDE ETCH ",
    eqps: ["EQP01_CH_A", " EQP01_CH_A ", "EQP02_CH_B"],
    periode: "15",
    comment: " 점검 대상 ",
  }, " user01 ")

  assert.deepEqual(payload, {
    line: "P1D",
    sdwt: "DREAMS P1D",
    prcGroup: "OXIDE ETCH",
    eqps: ["EQP01_CH_A", "EQP02_CH_B"],
    periode: 15,
    comment: "점검 대상",
    knoxId: "user01",
  })
})

test("knox_id 조회에 실패하면 접속 IP를 사용한다", async () => {
  const userId = await resolveRegistrationUserId("10.20.30.40", async () => {
    throw new Error("사용자 없음")
  })

  assert.equal(userId, "10.20.30.40")
})

test("잘못된 모니터링 기간은 거부한다", () => {
  assert.throws(() => buildMyEqpRegistrationPayload({
    line: "P1D",
    sdwt: "DREAMS P1D",
    prcGroup: "OXIDE ETCH",
    eqps: ["EQP01_CH_A"],
    periode: 0,
  }, "user01"), /1 이상의 정수/)
})

test("Comment가 90자를 초과하면 거부한다", () => {
  assert.throws(() => buildMyEqpRegistrationPayload({
    line: "P1D",
    sdwt: "DREAMS P1D",
    prcGroup: "OXIDE ETCH",
    eqps: ["EQP01_CH_A"],
    periode: 15,
    comment: "가".repeat(91),
  }, "user01"), /90자 이내/)
})

test("My EQP 등록 API는 POST만 허용한다", async () => {
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

  await handleMyEqpRegistrationRequest({ method: "GET" }, response)

  assert.equal(response.statusCode, 405)
  assert.equal(JSON.parse(response.body).error, "Method not allowed")
})
