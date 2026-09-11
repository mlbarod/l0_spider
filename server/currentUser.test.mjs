import assert from "node:assert/strict"
import { Readable } from "node:stream"
import test from "node:test"
import { getSsoCurrentUser, handleCurrentUserRequest } from "./currentUser.mjs"
import { handleHitHistoryRequest } from "./hitHistory.mjs"
import { handleClickedCategoryHistoryRequest } from "./clickedCategoryHistory.mjs"
import { handlePassHistoryRequest } from "./passHistory.mjs"
import { handleMyEqpRegistrationRequest } from "./myEqpRegistration.mjs"
import { handleMyEqpEquipmentDataRequest } from "./selfEquipmentData.mjs"

const filePath = "/appdata/abnormal_trend/pic/erd/2026-07-17/SDWT-1/ETCH/V1/PPID-1/A/TEMP/10@001/EQP-1.png"
const body = { lineId: "P1L", filePath, filePaths: [filePath], app: "self", grades: ["A"], knoxId: "forged-user", userid: "forged-user" }
function request(method, userId, payload = body, ip = "198.51.100.2") {
  return Object.assign(Readable.from([JSON.stringify(payload)]), {
    method, ssoRequired: true, ...(userId ? { auth: { knoxId: userId } } : {}),
    headers: { "x-forwarded-for": ip, "x-real-ip": ip, "x-knox-id": "forged-user" },
    socket: { remoteAddress: ip },
  })
}
function response() {
  return { writeHead(status) { this.status = status }, end(body) { this.payload = JSON.parse(body) } }
}
const mutations = [
  ["HIT", (req, res, helper) => handleHitHistoryRequest(req, res, { helper }), "POST"],
  ["클릭", (req, res, helper) => handleClickedCategoryHistoryRequest(req, res, { helper }), "POST"],
  ["SKIP", (req, res, helper) => handlePassHistoryRequest(req, res, undefined, { helper: (_action, record) => helper(record) }), "POST"],
  ["SKIP 해제", (req, res, helper) => handlePassHistoryRequest(req, res, undefined, { helper: (_action, record) => helper(record) }), "DELETE"],
]
for (const [name, handle, method] of mutations) {
  test(`${name}: 같은 IP의 다른 세션과 IP 변경에도 저장 실행자는 SSO userid`, async () => {
    for (const [userId, ip] of [["User.One", "198.51.100.2"], ["User.Two", "198.51.100.2"], ["User.One", "203.0.113.4"], ["User.One", ""]]) {
      const res = response()
      let stored
      await handle(request(method, userId, body, ip), res, async record => {
        stored = record
        return { ok: true, affectedRows: 1 }
      })
      assert.equal(res.status, 200)
      assert.equal(stored.knoxId, userId)
    }
  })
  test(`${name}: 인증 없는 잘못된 JSON도 본문 처리 전에 거부한다`, async () => {
    const req = Object.assign(Readable.from(["invalid-json"]), { method, ssoRequired: true })
    const res = response()
    await handle(req, res, () => assert.fail("Unauthenticated request reached database helper"))
    assert.equal(res.status, 401)
    assert.equal(req.readableDidRead, false)
  })
  test(`${name}: 인증 없는 IP·본문 userid는 저장 전에 401`, async () => {
    for (const ssoRequired of [true, false]) {
      const req = request(method)
      req.ssoRequired = ssoRequired
      const res = response()
      await handle(req, res, () => assert.fail("Unauthenticated request reached database helper"))
      assert.equal(res.status, 401)
      assert.equal(res.payload.code, "SSO_AUTHENTICATION_REQUIRED")
    }
  })
}
test("일괄 SKIP의 모든 행은 세션 userid를 사용한다", async () => {
  const res = response()
  await handlePassHistoryRequest(request("POST", "batch.user", { records: [body, { ...body, knoxId: "other" }] }), res, undefined, {
    helper: async (action, payload) => {
      assert.equal(action, "insert-many")
      assert.deepEqual(payload.records.map(record => record.knoxId), ["batch.user", "batch.user"])
      return { ok: true }
    },
  })
  assert.equal(res.status, 200)
})
test("현재 사용자와 My EQP는 IP 대체 없이 인증 누락을 거부한다", async () => {
  for (const handle of [
    (req, res) => handleCurrentUserRequest(req, res),
    (req, res) => handleMyEqpRegistrationRequest(req, res, new URL("http://localhost/?line=P1L"), { mappingReader: async () => ({ line_mapping: { TEAM: "P1L" }, sdwt_mapping: { TEAM: "SDWT" } }) }),
    (req, res) => handleMyEqpEquipmentDataRequest(req, res, new URL("http://localhost/?line=P1L")),
  ]) {
    const res = response()
    await handle(request("GET"), res)
    assert.equal(res.status, 401)
  }
  for (const knoxId of [undefined, "", "  ", 42]) {
    assert.throws(() => getSsoCurrentUser({ ssoRequired: true, auth: { knoxId } }), { code: "SSO_AUTHENTICATION_REQUIRED" })
  }
  const res = response()
  await handleCurrentUserRequest(request("GET", "User.One"), res)
  assert.deepEqual(res.payload, { ok: true, knoxId: "User.One" })
})
