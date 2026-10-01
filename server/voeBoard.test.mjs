import test from "node:test"
import assert from "node:assert/strict"
import { Readable } from "node:stream"
import { createVoeHandler } from "./voeBoard.mjs"

async function call({ method = "GET", path = "/api/voe", body, auth = true, role = "general", run = async () => ({ ok: true, posts: [] }), notify = async () => {} } = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  Object.assign(req, { method, headers: { "content-type": "application/json", "x-quality-hub-role": "master" },
    ssoRequired: auth, auth: auth ? { knoxId: "Test.User", displayName: "테스트 사용자" } : undefined, accessRole: role })
  const res = { writeHead(status) { this.status = status }, end(value) { this.body = JSON.parse(value) } }
  await createVoeHandler({ run, notify: context => notify(context, res) })(req, res, new URL(path, "http://localhost"))
  return res
}

test("SSO 없는 요청과 차단된 권한은 DB 호출 전에 거절한다", async () => {
  const run = () => assert.fail("DB에 접근하면 안 됩니다")
  assert.equal((await call({ auth: false, run })).status, 401)
  assert.equal((await call({ role: "blocked", run })).status, 403)
})
test("클라이언트가 보낸 사용자/마스터 정보 대신 SSO 신원을 전달한다", async () => {
  const res = await call({ method: "POST", path: "/api/voe/questions", body: { actor: { userId: "victim", role: "master" }, title: "요청" }, run: async payload => {
    assert.deepEqual(payload.actor, { userId: "test.user", displayName: "테스트 사용자", role: "general" })
    assert.equal(payload.action, "create")
    return { ok: true }
  } })
  assert.equal(res.status, 201)
})
test("identity는 사용자와 SSO 권한만 제공한다", async () => {
  const res = await call({ path: "/api/voe/identity", role: "master" })
  assert.equal(res.body.role, "master")
  assert.equal(res.body.user.userId, "test.user")
  assert.deepEqual(Object.keys(res.body).sort(), ["role", "user"])
})
test("답변 경로를 해석하고 잘못된 ID/메서드를 거절한다", async () => {
  const res = await call({ method: "PATCH", path: "/api/voe/questions/2/messages/3", body: { operation: "hide" }, run: async payload => {
    assert.equal(payload.action, "message")
    assert.equal(payload.questionId, 2)
    assert.equal(payload.messageId, 3)
    return { ok: true }
  } })
  assert.equal(res.status, 200)
  assert.equal((await call({ method: "DELETE" })).status, 405)
  assert.equal((await call({ path: "/api/voe/questions/999999999999999999" })).status, 400)
  assert.equal((await call({ path: "/api/voe/notifications/1" })).status, 400)
})
test("권한·용량·DB 실패를 안전한 응답으로 변환한다", async () => {
  for (const [code, status] of [["QNA_FORBIDDEN", 403], ["QNA_NOT_FOUND", 404], ["BODY_TOO_LARGE", 413], ["DB_FAILED", 503]]) {
    const res = await call({ run: async () => { throw Object.assign(new Error("비밀번호=secret"), { code }) } })
    assert.equal(res.status, status)
    assert.ok(!JSON.stringify(res.body).includes("secret"))
  }
})

test("질문·답변 저장 성공 응답 뒤에 저장된 본문과 SSO 작성자로 한 번 발송한다", async () => {
  for (const [path, action] of [["/api/voe/questions", "create"], ["/api/voe/questions/2/messages", "reply"]]) {
    const post = { questionId: 2, content: "저장된 본문", authorUserId: "owner" }
    let calls = 0
    const res = await call({ method: "POST", path, body: { bodyHtml: "요청 본문", recipients: ["attacker"], actor: { userId: "attacker" } },
      run: async () => ({ ok: true, post }), notify: async (context, response) => {
        calls++
        assert.equal(response.status, 201)
        assert.deepEqual(response.body, { ok: true, post })
        assert.equal(context.post, post)
        assert.equal(context.action, action)
        assert.equal(context.actor.userId, "test.user")
      } })
    assert.equal(res.status, 201)
    assert.equal(calls, 1)
  }
})

test("저장 실패·권한 실패·조회·수정·삭제·복구에는 발송하지 않는다", async () => {
  let calls = 0
  const notify = () => { calls++ }
  for (const code of ["DB_FAILED", "QNA_FORBIDDEN", "VALIDATION_FAILED"]) {
    await call({ method: "POST", path: "/api/voe/questions", body: {}, notify,
      run: async () => { throw Object.assign(new Error(), { code }) } })
  }
  await call({ auth: false, notify })
  await call({ role: "blocked", notify })
  await call({ notify })
  for (const path of ["/api/voe/questions/2", "/api/voe/questions/2/messages/3"]) {
    for (const operation of ["edit", "hide", "restore", "status", "final"]) {
      assert.equal((await call({ method: "PATCH", path, body: { operation }, notify })).status, 200)
    }
  }
  assert.equal(calls, 0)
})

test("예상하지 못한 발송 실패도 저장 성공 응답을 바꾸지 않는다", async t => {
  t.mock.method(console, "warn", () => {})
  const res = await call({ method: "POST", path: "/api/voe/questions", body: {},
    notify: async () => { throw new Error("secret") } })
  assert.equal(res.status, 201)
  assert.deepEqual(res.body, { ok: true, posts: [] })
  assert.deepEqual(console.warn.mock.calls[0].arguments, ["[voe-mail] notification_failed"])
})
