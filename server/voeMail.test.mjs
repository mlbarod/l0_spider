import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildVoeMail, createVoeMailNotifier } from "./voeMail.mjs"
import { richHtmlToMailHtml } from "./voeMailHtml.mjs"
import { createAccessControl, createAccessStore } from "./accessControl.mjs"

const env = { KNOX_MAIL_ENABLED: "true", KNOX_MAIL_TOKEN: "synthetic-token", KNOX_MAIL_SYSTEM_ID: "synthetic-system",
  KNOX_MAIL_TIMEOUT_MS: "100", SSO_REDIRECT_URI: "https://spider.example/auth/callback" }
const actor = { userId: "writer", displayName: "작성자 <테스트>" }
const req = { ssoRequired: true, auth: { knoxId: "Writer" }, headers: { origin: "https://untrusted.example" } }
const post = { questionId: 12, title: "메일 & 서식 확인", category: "L0 SPIDER", authorUserId: "owner",
  content: '<p>질문 <strong>강조</strong><span data-qna-font-size="24">큰 글씨</span></p><table><tr><td colspan="2">표 내용</td></tr></table><img src="data:image/png;base64,AAAA">',
  messages: [{ authorUserId: "old", content: "이전 답변" }, { authorUserId: "writer", content: "<p>새 답변</p>" }] }
const input = { action: "create", post, actor, masterUserIds: ["Master.One", "master.two"],
  sender: { emailAddress: "writer@samsung.com" }, portalUrl: env.SSO_REDIRECT_URI }
const context = { req, action: "create", post, actor }

test("질문 제목·마스터 수신자·Quality-Hub 본문 서식과 실제 게시글 링크", () => {
  const mail = buildVoeMail(input)
  assert.equal(mail.subject, "[SPIDER VOE] L0 SPIDER-메일 & 서식 확인")
  assert.deepEqual(mail.recipients, ["master.one", "master.two"].map(id => ({ emailAddress: `${id}@samsung.com`, recipientType: "TO" })))
  assert.equal(mail.docSecuType, "PERSONAL")
  assert.equal(mail.contentType, "HTML")
  assert.match(mail.contents, /작성자: 작성자 &lt;테스트&gt;<br>구분: L0 SPIDER/)
  assert.match(mail.contents, /https:\/\/spider.example\/voe\?questionId=12/)
  assert.match(mail.contents, /질문 본문/)
  assert.match(mail.contents, /font-size:24pt/)
  assert.match(mail.contents, /border-collapse:collapse/)
  assert.match(mail.contents, /colspan="2"/)
  assert.match(mail.contents, /\[이미지: 게시글에서 확인\]/)
  assert.doesNotMatch(mail.contents, /라인:|추가 답변|<img|data:image|이전 답변/)
})

test("답변은 마스터와 글 작성자를 합치고 중복 제거하며 새 답변만 추가한다", () => {
  const mail = buildVoeMail({ ...input, action: "reply", masterUserIds: ["MASTER.ONE", "Owner", "owner", "writer"] })
  assert.deepEqual(mail.recipients.map(r => r.emailAddress), ["master.one@samsung.com", "owner@samsung.com", "writer@samsung.com"])
  assert.equal(mail.subject, "[SPIDER VOE] 답변: L0 SPIDER-메일 & 서식 확인")
  assert.match(mail.contents, /질문 본문[\s\S]*질문[\s\S]*<hr[\s\S]*추가 답변[\s\S]*새 답변/)
  assert.doesNotMatch(mail.contents, /이전 답변/)
  assert.throws(() => buildVoeMail({ ...input, action: "reply", post: { ...post, messages: [] } }))
})

test("메일 본문에서 실행 코드·외부 이미지·위험한 링크와 임의 스타일을 제거한다", () => {
  const html = richHtmlToMailHtml('<script>secret</script><svg><text>hidden</text></svg><p onclick="bad()" style="display:none"><a href="javascript:alert(1)">링크</a><img src="https://tracker.example"><span data-qna-font-size="999">텍스트</span></p><a href="/voe">정상 링크</a>', env.SSO_REDIRECT_URI)
  assert.doesNotMatch(html, /secret|hidden|onclick|javascript|tracker|999|<img|display:none/)
  assert.match(html, /href="https:\/\/spider.example\/voe"/)
  assert.throws(() => buildVoeMail({ ...input, masterUserIds: ["bad@example.com"] }))
  assert.throws(() => buildVoeMail({ ...input, post: { ...post, hidden: true } }))
  assert.equal(buildVoeMail({ ...input, post: { ...post, title: "제목\r\n다음" } }).subject, "[SPIDER VOE] L0 SPIDER-제목 다음")
})

test("Chart Mailing 인증·발신자·타임아웃을 재사용하고 현재 마스터 목록을 매번 읽는다", async t => {
  const directory = mkdtempSync(join(tmpdir(), "voe-mail-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const store = createAccessStore({ filePath: join(directory, "access.json"), bootstrapUserIds: ["master.one"] })
  const access = createAccessControl({ enabled: true, environment: env, store })
  const sent = [], logs = []
  const notify = createVoeMailNotifier({ env, getMasterUserIds: () => access.getMasterUserIds(), logger: line => logs.push(line),
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://openapi.samsung.net/mail/api/v2.0/mails/send?userId=writer")
      assert.equal(options.method, "POST")
      assert.equal(options.redirect, "error")
      assert.equal(options.headers.Authorization, "Bearer synthetic-token")
      assert.equal(options.headers["System-ID"], "synthetic-system")
      assert.ok(options.signal instanceof AbortSignal)
      sent.push(JSON.parse(options.body))
      return new Response('{}', { status: 200 })
    } })
  await notify(context)
  store.mutate({ knoxId: "master.one" }, "POST", { target: "master", userId: "master.two" })
  store.mutate({ knoxId: "master.two" }, "DELETE", { target: "master", userId: "master.one" })
  await notify({ ...context, action: "reply" })
  assert.deepEqual(sent[0].recipients.map(r => r.emailAddress), ["master.one@samsung.com"])
  assert.deepEqual(sent[1].recipients.map(r => r.emailAddress), ["master.two@samsung.com", "owner@samsung.com"])
  assert.deepEqual(sent[1].sender, { emailAddress: "writer@samsung.com" })
  assert.match(logs.join("\n"), /http_response_unverified/)
  assert.doesNotMatch(logs.join("\n"), /synthetic-token|synthetic-system|@samsung|메일 & 서식|작성자/)
})

test("비활성화·설정 오류·마스터 조회 실패에는 API를 호출하지 않는다", async () => {
  for (const overrides of [
    { env: { ...env, KNOX_MAIL_ENABLED: "false" } },
    { env: { ...env, KNOX_MAIL_TOKEN: "" } },
    { env: { ...env, SSO_REDIRECT_URI: undefined } },
    { getMasterUserIds: () => { throw new Error("secret") } },
    { getMasterUserIds: () => [] },
  ]) {
    const logs = []
    let calls = 0
    await createVoeMailNotifier({ env, getMasterUserIds: () => ["master.one"], logger: line => logs.push(line),
      fetchImpl: () => { calls++; return new Response('{}') }, ...overrides })(context)
    assert.equal(calls, 0)
    assert.equal(logs.length, 1)
    assert.doesNotMatch(logs[0], /secret|synthetic-token/)
  }
})

test("API 거절·명시적 실패·잘못된 응답·타임아웃을 안전하게 기록하고 재전송하지 않는다", async () => {
  for (const fetchResult of [
    () => new Response('{"error":"secret"}', { status: 403 }),
    () => new Response('{"success":false,"message":"secret"}'),
    () => new Response('<html>secret</html>'),
    () => { throw Object.assign(new Error("secret"), { name: "TimeoutError" }) },
  ]) {
    let calls = 0
    const logs = []
    await createVoeMailNotifier({ env, getMasterUserIds: () => ["master.one"], logger: line => logs.push(line),
      fetchImpl: async () => { calls++; return fetchResult() } })(context)
    assert.equal(calls, 1)
    assert.match(logs[0], /result_unknown/)
    assert.doesNotMatch(logs[0], /http_response_unverified|secret|synthetic-token/)
  }
})
