import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMyEqpDebugRows,
  buildMyEqpRegistrationPayload,
  groupMyEqpRegistrationRecords,
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

  assert.match(payload.execDate, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  delete payload.execDate

  assert.deepEqual(payload, {
    line: "P1D",
    sdwt: "DREAMS P1D",
    prcGroup: "OXIDE ETCH",
    eqps: ["EQP01_CH_A", "EQP02_CH_B"],
    periode: 15,
    comment: "점검 대상",
    knoxId: "user01",
    isPublic: false,
  })
})

test("전체 공개 선택을 공개 My EQP 값으로 정규화한다", () => {
  const payload = buildMyEqpRegistrationPayload({
    line: "P1D",
    sdwt: "DREAMS P1D",
    prcGroup: "OXIDE ETCH",
    eqps: ["EQP01_CH_A"],
    periode: 15,
    isPublic: true,
  }, "user01")

  assert.equal(payload.isPublic, true)
})

test("복수 선택한 EQP를 EQP별 개별 DB 행으로 만든다", () => {
  const rows = buildMyEqpDebugRows({
    line: "P1D",
    sdwt: "DREAMS P1D",
    prcGroup: "OXIDE ETCH",
    eqps: ["EQP01_CH_A", "EQP02_CH_B"],
    execDate: "2026-07-18 14:30:00",
    periode: 15,
    comment: "점검 대상",
    knoxId: "user01",
    isPublic: true,
  })

  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((row) => row.eqp), ["EQP01_CH_A", "EQP02_CH_B"])
  assert.ok(rows.every((row) => row.line === "P1D" && row.periode === 15))
  assert.ok(rows.every((row) => row.is_public === 1))
})

test("동일 저장 조건의 EQP 행을 하나의 등록 조건으로 묶고 만료를 계산한다", () => {
  const records = ["EQP01_CH_A", "EQP02_CH_B"].map((eqp) => ({
    line: "P1D",
    sdwt: "DREAMS P1D",
    prc_group: "OXIDE ETCH",
    eqp,
    exec_date: "2026-07-18 10:00:00",
    periode: 7,
    comment: "점검 대상",
    knox_id: "user01",
    is_public: 1,
  }))

  const groups = groupMyEqpRegistrationRecords(records, Date.parse("2026-07-20T10:00:00"))

  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].eqps, ["EQP01_CH_A", "EQP02_CH_B"])
  assert.equal(groups[0].expiresAt, "2026-07-25 10:00:00")
  assert.equal(groups[0].active, true)
  assert.equal(groups[0].isPublic, true)

  const expiredGroups = groupMyEqpRegistrationRecords(records, Date.parse("2026-07-25T10:00:00"))
  assert.equal(expiredGroups[0].active, false)
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

test("My EQP 등록 API는 GET, POST, DELETE 외 요청을 거부한다", async () => {
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

  await handleMyEqpRegistrationRequest({ method: "PUT" }, response)

  assert.equal(response.statusCode, 405)
  assert.equal(JSON.parse(response.body).error, "Method not allowed")
})
