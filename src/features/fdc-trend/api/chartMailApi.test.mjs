import assert from "node:assert/strict"
import test from "node:test"
import { sendChartMail } from "./chartMailApi.js"

test("프록시 HTML 오류와 잘못된 JSON 응답은 HTTP 상태를 포함해 결과 불명으로 안내한다", async (t) => {
  for (const status of [200, 403, 413, 502]) {
    t.mock.method(globalThis, "fetch", async () => new Response("<html>private proxy response</html>", { status }))
    await assert.rejects(sendChartMail({}), (error) => {
      assert.equal(error.code, "UNKNOWN_RESPONSE")
      assert.match(error.message, new RegExp(`HTTP ${status}`))
      assert.match(error.message, /수신 여부/)
      assert.doesNotMatch(error.message, /private proxy/)
      return true
    })
    t.mock.restoreAll()
  }
})

test("발송 오류의 문의 코드와 HTTP 상태를 화면에 전달한다", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    ok: false, code: "MAIL_REJECTED", error: "HTTP 401: 메일 API 인증이 거절되었습니다.", requestId: "12345678-1234-1234-1234-123456789abc",
  }), { status: 502 }))
  await assert.rejects(sendChartMail({}), (error) => {
    assert.equal(error.code, "MAIL_REJECTED")
    assert.match(error.message, /HTTP 401/)
    assert.match(error.message, /문의 코드: 12345678-1234-1234-1234-123456789abc/)
    return true
  })
})

test("JSON null 응답도 결과 불명으로 처리한다", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("null", { status: 200 }))
  await assert.rejects(sendChartMail({}), { code: "UNKNOWN_RESPONSE" })
})
