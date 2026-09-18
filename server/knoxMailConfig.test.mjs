import assert from "node:assert/strict"
import test from "node:test"
import { loadKnoxMailConfig, prepareKnoxMailRequest } from "./knoxMailConfig.mjs"

const env = {
  KNOX_MAIL_ENABLED: "true",
  KNOX_MAIL_TOKEN: "synthetic-token",
  KNOX_MAIL_SYSTEM_ID: "synthetic-system",
}
const request = { ssoRequired: true, auth: { knoxId: "Test.User" }, body: { sender: "spoofed" } }

test("비활성 설정과 잘못된 인증정보를 구분하며 오류에 실제 값을 노출하지 않는다", () => {
  assert.equal(loadKnoxMailConfig({}), null)
  assert.equal(prepareKnoxMailRequest(request, { ...env, KNOX_MAIL_ENABLED: "false" }), null)
  for (const key of ["KNOX_MAIL_TOKEN", "KNOX_MAIL_SYSTEM_ID"]) {
    for (const value of ["", "   ", "synthetic-secret\r\nInjected: value", "synthetic-secret\n"]) {
      assert.throws(() => loadKnoxMailConfig({ ...env, [key]: value }), (error) => {
        assert.equal(error.mailField, key)
        assert.doesNotMatch(error.message, /synthetic-secret|Injected/)
        return true
      })
    }
  }
  for (const value of ["-1", "99", "30001", "100.5", "invalid"]) {
    assert.throws(() => loadKnoxMailConfig({ ...env, KNOX_MAIL_TIMEOUT_MS: value }), { mailField: "KNOX_MAIL_TIMEOUT_MS" })
  }
  assert.equal(loadKnoxMailConfig(env).timeoutMs, 30000)
  assert.equal(loadKnoxMailConfig({ ...env, KNOX_MAIL_TIMEOUT_MS: "5000" }).timeoutMs, 5000)
  assert.equal(loadKnoxMailConfig({ ...env, KNOX_MAIL_TIMEOUT_MS: "1000" }).timeoutMs, 1000)
})

test("Quality-Hub API와 인증 헤더를 사용하고 발신자·userId를 SSO 사용자에 일치시킨다", () => {
  const prepared = prepareKnoxMailRequest(request, env)
  assert.equal(prepared.url, "https://openapi.samsung.net/mail/api/v2.0/mails/send?userId=test.user")
  assert.equal(prepared.sender.emailAddress, "test.user@samsung.com")
  assert.equal(prepared.method, "POST")
  assert.equal(prepared.redirect, "error")
  assert.equal(prepared.headers.Authorization, "Bearer synthetic-token")
  assert.equal(prepared.headers["System-ID"], "synthetic-system")
  assert.equal(prepared.headers["Content-Type"], "application/json")
  assert.equal(prepared.timeoutMs, 30000)
  assert.throws(() => prepareKnoxMailRequest({ ...request, ssoRequired: false }, env), { code: "SSO_AUTHENTICATION_REQUIRED" })
  assert.throws(() => prepareKnoxMailRequest({ ...request, auth: { knoxId: "bad?userId=other" } }, env), /Knox ID/)
})
