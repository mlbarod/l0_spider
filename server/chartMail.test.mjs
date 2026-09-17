import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { randomUUID } from "node:crypto"
import { buildChartMail, createChartMailHandler } from "./chartMail.mjs"
import { createChartMailStore } from "./chartMailStore.mjs"
import { CHART_MAIL_COMMENTS, MAX_CHART_IMAGE_BYTES } from "../src/features/fdc-trend/utils/chartMail.mjs"

const env = { KNOX_MAIL_ENABLED: "true", KNOX_MAIL_TOKEN: "synthetic-token", KNOX_MAIL_SYSTEM_ID: "synthetic-system", KNOX_MAIL_TIMEOUT_MS: "100" }
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC6sAAAAASUVORK5CYII="
const draft = () => ({ requestId: randomUUID(), title: "[SPIDER] 차트 <제목>", details: "Sensor: <img src=x onerror=alert(1)>\nLine: A&B", comment: CHART_MAIL_COMMENTS[0], recipients: ["recipient.test", "RECIPIENT.TEST@samsung.com"], image: `data:image/png;base64,${png}`, sender: { emailAddress: "spoofed@samsung.com" } })
function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "spider-chart-mail-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const filePath = join(directory, "requests.json")
  const calls = []
  const logs = []
  const store = createChartMailStore({ filePath })
  const handler = createChartMailHandler({ env, store, logger: (line) => logs.push(line), fetchImpl: async (...args) => { calls.push(args); return new Response(null, { status: 202 }) }, ...options })
  return { handler, calls, logs, store, filePath }
}
async function call(handler, { method = "POST", body = draft(), user = "Sender.Test", authenticated = true, raw, headers = {} } = {}) {
  const req = Readable.from([raw ?? JSON.stringify(body)])
  Object.assign(req, { method, headers: { "content-type": "application/json", ...headers }, ssoRequired: authenticated, auth: { knoxId: user } })
  const result = {}
  await handler(req, { writeHead(status, responseHeaders) { result.status = status; result.headers = responseHeaders }, end(value) { result.body = JSON.parse(value) } })
  return result
}

test("HTML 본문 PNG와 수신인 중복 제거, SSO 발신자 및 인증 헤더를 연결한다", async (t) => {
  const f = fixture(t)
  assert.equal((await call(f.handler, { method: "GET" })).body.ready, true)
  assert.equal(f.calls.length, 0)
  const input = draft()
  const response = await call(f.handler, { body: input })
  assert.equal(response.body.status, "accepted")
  assert.equal(f.calls.length, 1)
  const [url, request] = f.calls[0]
  assert.equal(url, "https://openapi.samsung.net/mail/api/v2.0/mails/send?userId=sender.test")
  assert.equal(request.headers.Authorization, "Bearer synthetic-token")
  assert.equal(request.headers["System-ID"], "synthetic-system")
  assert.equal(request.method, "POST")
  assert.equal(request.redirect, "error")
  const payload = JSON.parse(request.body)
  assert.equal(payload.contentType, "HTML")
  assert.equal(payload.docSecuType, "PERSONAL")
  assert.deepEqual(payload.sender, { emailAddress: "sender.test@samsung.com" })
  assert.deepEqual(payload.recipients, [{ emailAddress: "recipient.test@samsung.com", recipientType: "TO" }])
  assert.ok(payload.contents.includes(`<img src="${input.image}"`))
  assert.match(payload.contents, /&lt;img src=x onerror=alert\(1\)&gt;<br>Line: A&amp;B/)
  assert.doesNotMatch(payload.contents, /<img src=x/)
  assert.equal(statSync(f.filePath).mode & 0o777, 0o600)
  assert.doesNotMatch(readFileSync(f.filePath, "utf8") + JSON.stringify([response, f.logs]), /synthetic-token|synthetic-system|sender.test|recipient.test|iVBOR/)
})

test("로그인·설정·HTTP 메서드 실패는 외부 호출을 하지 않는다", async (t) => {
  const f = fixture(t)
  for (const method of ["GET", "POST"]) assert.equal((await call(f.handler, { method, authenticated: false })).status, 401)
  assert.equal((await call(f.handler, { method: "DELETE" })).status, 405)
  assert.equal(f.calls.length, 0)
  for (const settings of [{}, { ...env, KNOX_MAIL_TOKEN: "" }, { ...env, KNOX_MAIL_SYSTEM_ID: "bad\nsecret" }]) {
    const disabled = fixture(t, { env: settings })
    assert.equal((await call(disabled.handler, { method: "GET" })).body.ready, false)
    assert.equal((await call(disabled.handler)).status, 503)
    assert.equal(disabled.calls.length, 0)
  }
})

test("이미지·수신인·본문 검증과 요청 크기 제한은 발송 전에 적용한다", async (t) => {
  const f = fixture(t)
  const invalid = [null, [], { requestId: "bad" }, { title: "Header\r\nInjected" }, { details: "x".repeat(10001) }, { comment: "custom" }, { recipients: [] }, { recipients: ["bad@external.test"] }, { recipients: Array.from({ length: 101 }, (_, i) => `r${i}`) }, { image: "https://external.test/image.png" }, { image: "data:image/svg+xml;base64,AAAA" }, { image: "data:image/png;base64,AAAA" }, { image: `data:image/png;base64,${png}" onerror="evil` }, { image: `data:image/png;base64,${Buffer.alloc(MAX_CHART_IMAGE_BYTES + 1).toString("base64")}` }]
  for (const change of invalid) {
    const body = change === null || Array.isArray(change) ? change : { ...draft(), ...change }
    assert.equal((await call(f.handler, { body })).status, 400)
  }
  assert.equal((await call(f.handler, { raw: "{" })).status, 400)
  assert.equal((await call(f.handler, { headers: { "content-type": "text/plain" } })).status, 400)
  assert.equal((await call(f.handler, { headers: { "content-length": "10000000" } })).status, 400)
  assert.equal((await call(f.handler, { raw: "x".repeat(8 * 1024 * 1024) })).status, 400)
  assert.equal(f.calls.length, 0)
  assert.throws(() => buildChartMail({ ...draft(), image: `data:image/png;base64,${Buffer.from(png, "base64").subarray(0, 30).toString("base64")}` }, {}))
})

test("동일 요청은 재시작 후에도 재전송하지 않고 다른 내용은 충돌로 처리한다", async (t) => {
  const f = fixture(t)
  const body = draft()
  await call(f.handler, { body })
  assert.equal((await call(f.handler, { body })).body.status, "accepted")
  assert.equal((await call(f.handler, { body: { ...body, title: "changed" } })).body.code, "MAIL_REQUEST_CONFLICT")
  const restarted = createChartMailHandler({ env, store: createChartMailStore({ filePath: f.filePath }), fetchImpl: async () => { assert.fail("중복 외부 호출") } })
  assert.equal((await call(restarted, { body })).body.status, "accepted")
  assert.equal(f.calls.length, 1)
  // 새 요청 ID와 다른 로그인 사용자는 각각 독립적인 발송 동작이다.
  await call(f.handler, { body: { ...body, requestId: randomUUID() } })
  await call(f.handler, { body, user: "other.sender" })
  assert.equal(f.calls.length, 3)
})

test("동시 요청과 재시작 시 남은 pending 기록은 중복 발송을 막는다", async (t) => {
  let release, started
  const began = new Promise((resolve) => { started = resolve })
  const gate = new Promise((resolve) => { release = resolve })
  let calls = 0
  const f = fixture(t, { fetchImpl: async () => { calls++; started(); await gate; return new Response(null, { status: 202 }) } })
  const body = draft()
  const first = call(f.handler, { body })
  await began
  try {
    assert.equal((await call(f.handler, { body })).body.code, "MAIL_IN_PROGRESS")
    const restarted = createChartMailHandler({ env, store: createChartMailStore({ filePath: f.filePath }), fetchImpl: async () => assert.fail("pending 재발송") })
    assert.equal((await call(restarted, { body })).body.code, "MAIL_IN_PROGRESS")
  } finally { release() }
  assert.equal((await first).body.status, "accepted")
  assert.equal(calls, 1)
})

test("거절·서버 오류·연결 유실·타임아웃은 자동 재시도 없이 보관한다", async (t) => {
  for (const mode of [400, 408, 500, "network", "timeout"]) {
    let calls = 0
    const f = fixture(t, { fetchImpl: async (_, { signal }) => {
      calls++
      if (mode === "network") throw new Error("private token remote details")
      if (mode === "timeout") return new Promise((_, reject) => {
        const keepAlive = setTimeout(() => reject(new Error("timeout test failed")), 1000)
        signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(signal.reason) }, { once: true })
      })
      return new Response("private token remote details", { status: mode })
    } })
    const body = draft()
    const response = await call(f.handler, { body })
    assert.equal(response.body.code, mode === 400 ? "MAIL_REJECTED" : "MAIL_RESULT_UNKNOWN")
    assert.equal((await call(f.handler, { body })).body.code, response.body.code)
    assert.equal(calls, 1)
    assert.doesNotMatch(JSON.stringify([response, f.logs]), /private|token|remote details/)
  }
})

test("기록 저장 실패·손상 시 발송하지 않고 전송 후 저장 실패는 결과 불명으로 남긴다", async (t) => {
  const f = fixture(t)
  writeFileSync(f.filePath, "broken-private-store")
  const response = await call(f.handler)
  assert.equal(response.body.code, "MAIL_REQUEST_STORAGE_ERROR")
  assert.equal(readFileSync(f.filePath, "utf8"), "broken-private-store")
  assert.equal(f.calls.length, 0)
  const failure = fixture(t, { store: { claim() { throw new Error("private path") } } })
  assert.equal((await call(failure.handler)).body.code, "MAIL_REQUEST_STORAGE_ERROR")
  assert.equal(failure.calls.length, 0)
  const saved = fixture(t)
  const lateFailure = createChartMailHandler({ env, store: { claim: saved.store.claim, finish() { throw new Error("private disk error") } }, fetchImpl: async () => new Response(null, { status: 202 }) })
  const body = draft()
  assert.equal((await call(lateFailure, { body })).body.code, "MAIL_RESULT_UNKNOWN")
  assert.equal((await call(saved.handler, { body })).body.code, "MAIL_IN_PROGRESS")
  assert.equal(saved.calls.length, 0)
  assert.doesNotMatch(JSON.stringify([response, f.logs]), /broken-private|private-store/)
})

test("HTTP 인증·권한·용량 오류의 상태와 문의 코드를 화면·로그·기록에 함께 남긴다", async (t) => {
  for (const status of [401, 403, 413]) {
    const f = fixture(t, { fetchImpl: async () => new Response("synthetic-token private recipient.test@samsung.com", { status }) })
    const body = draft()
    const result = await call(f.handler, { body })
    assert.equal(result.body.code, "MAIL_REJECTED")
    assert.match(result.body.error, new RegExp(`HTTP ${status}`))
    assert.equal(result.body.diagnostics.upstreamStatus, status)
    assert.match(result.body.requestId, /^[a-f0-9-]{36}$/)
    const log = f.logs.map((line) => JSON.parse(line.slice("[chart-mail] ".length))).find((row) => row.event === "rejected")
    assert.equal(log.requestId, result.body.requestId)
    assert.equal(log.upstreamStatus, status)
    const record = JSON.parse(readFileSync(f.filePath, "utf8")).requests[0]
    assert.deepEqual(record.diagnostics, result.body.diagnostics)
    const duplicate = await call(f.handler, { body })
    assert.equal(duplicate.body.requestId, result.body.requestId)
    assert.deepEqual(duplicate.body.diagnostics, result.body.diagnostics)
    assert.doesNotMatch(JSON.stringify([result, f.logs, record]), /synthetic-token|private|recipient.test|samsung.com/)
  }
})

test("HTTP 200의 명시적 실패·HTML 오류페이지·과대 응답을 성공으로 표시하지 않는다", async (t) => {
  for (const text of [
    JSON.stringify({ success: false, message: "synthetic-token private sender.test@samsung.com" }),
    JSON.stringify({ data: { ok: false } }),
    JSON.stringify({ error: { secret: "synthetic-token" } }),
    JSON.stringify({ result: { status: "FAILED" } }),
    "<html>private error page</html>",
    "x".repeat(16385),
  ]) {
    let calls = 0
    const f = fixture(t, { fetchImpl: async () => { calls++; return new Response(text, { status: 200 }) } })
    const body = draft()
    const result = await call(f.handler, { body })
    assert.equal(result.body.code, "MAIL_RESULT_UNKNOWN")
    assert.equal(result.body.diagnostics.upstreamStatus, 200)
    assert.equal((await call(f.handler, { body })).body.code, "MAIL_RESULT_UNKNOWN")
    assert.equal(calls, 1)
    assert.doesNotMatch(JSON.stringify([result, f.logs]) + readFileSync(f.filePath, "utf8"), /synthetic-token|sender.test|private/)
  }
})

test("2xx HTTP 응답은 실제 전달 성공과 구분하고 알 수 없는 업무코드를 추측하지 않는다", async (t) => {
  const f = fixture(t, { fetchImpl: async () => new Response(JSON.stringify({ code: "undocumented-code", message: "private response" }), { status: 200 }) })
  const result = await call(f.handler)
  assert.equal(result.body.status, "accepted")
  assert.equal(result.body.deliveryVerified, false)
  assert.equal(result.body.diagnostics.responseKind, "json")
  assert.ok(f.logs.some((line) => line.includes('"event":"http_response_unverified"')))
  assert.doesNotMatch(JSON.stringify([result, f.logs]), /undocumented-code|private response/)
})

test("DNS·TLS·시간초과 진단에 원격 오류 메시지나 주소가 노출되지 않는다", async (t) => {
  for (const code of ["ENOTFOUND", "CERT_HAS_EXPIRED", "ETIMEDOUT", "private-error-code"]) {
    const f = fixture(t, { fetchImpl: async () => {
      throw Object.assign(new Error("synthetic-token https://private.example recipient.test@samsung.com"), { cause: { code } })
    } })
    const result = await call(f.handler)
    assert.equal(result.body.code, "MAIL_RESULT_UNKNOWN")
    assert.equal(result.body.diagnostics.networkCode, code === "private-error-code" ? "NETWORK_ERROR" : code)
    assert.ok(result.body.error.includes(result.body.diagnostics.networkCode))
    assert.doesNotMatch(JSON.stringify([result, f.logs]), /synthetic-token|private|recipient.test|samsung.com/)
  }
})

test("설정 오류는 필드 이름만 안내하고 로그 실패가 발송 상태를 변경하지 않는다", async (t) => {
  const f = fixture(t, { env: { ...env, KNOX_MAIL_TOKEN: "bad\nsynthetic-secret" } })
  const result = await call(f.handler, { method: "GET" })
  assert.equal(result.body.ready, false)
  assert.match(result.body.reason, /KNOX_MAIL_TOKEN/)
  assert.match(result.body.requestId, /^[a-f0-9-]{36}$/)
  assert.doesNotMatch(JSON.stringify([result, f.logs]), /synthetic-secret/)
  const logFailure = fixture(t, { logger() { throw new Error("private logging failure") } })
  assert.equal((await call(logFailure.handler)).body.status, "accepted")
  assert.equal(logFailure.calls.length, 1)
})

test("응답 스트림 오류는 HTTP 상태를 보존하고 결과 불명으로 기록한다", async (t) => {
  const f = fixture(t, { fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error("private stream error")) },
  }), { status: 200 }) })
  const result = await call(f.handler)
  assert.equal(result.body.code, "MAIL_RESULT_UNKNOWN")
  assert.equal(result.body.diagnostics.upstreamStatus, 200)
  assert.equal(result.body.diagnostics.responseKind, "unreadable")
  assert.doesNotMatch(JSON.stringify([result, f.logs]), /private stream/)
})

test("이전 기록과 진단 필드가 섞인 기록을 읽어도 허용된 진단만 반환한다", async (t) => {
  const f = fixture(t)
  const body = draft()
  await call(f.handler, { body })
  const saved = JSON.parse(readFileSync(f.filePath, "utf8"))
  delete saved.requests[0].diagnostics
  writeFileSync(f.filePath, JSON.stringify(saved))
  assert.equal((await call(f.handler, { body })).body.status, "accepted")
  saved.requests[0].diagnostics = { requestId: "private", upstreamStatus: "private", networkCode: "private", message: "synthetic-token", token: "synthetic-token" }
  writeFileSync(f.filePath, JSON.stringify(saved))
  const replay = await call(f.handler, { body })
  assert.equal(replay.body.status, "accepted")
  assert.doesNotMatch(JSON.stringify([replay, f.logs]), /private|synthetic-token/)
  assert.equal(f.calls.length, 1)
})

test("기본 30초와 명시한 제한 시간을 적용하고 TIMEOUT 화면·로그에 같은 값을 남긴다", async (t) => {
  const applied = []
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    applied.push(milliseconds)
    return new AbortController().signal
  })
  const defaultEnv = { ...env }
  delete defaultEnv.KNOX_MAIL_TIMEOUT_MS
  for (const settings of [defaultEnv, { ...env, KNOX_MAIL_TIMEOUT_MS: "5000" }]) {
    const expected = settings.KNOX_MAIL_TIMEOUT_MS ? 5000 : 30000
    const f = fixture(t, { env: settings, fetchImpl: async () => { throw new DOMException("synthetic timeout", "TimeoutError") } })
    const result = await call(f.handler)
    assert.equal(applied.at(-1), expected)
    assert.equal(result.body.code, "MAIL_RESULT_UNKNOWN")
    assert.equal(result.body.diagnostics.networkCode, "TIMEOUT")
    assert.equal(result.body.diagnostics.timeoutMs, expected)
    assert.ok(result.body.error.includes(`${expected / 1000}초`))
    const log = f.logs.map((line) => JSON.parse(line.slice("[chart-mail] ".length))).find((row) => row.event === "result_unknown")
    assert.equal(log.timeoutMs, expected)
    assert.equal(log.requestId, result.body.requestId)
  }
})

test("Undici 연결·헤더·본문 제한은 전체 30초 제한 초과와 구분한다", async (t) => {
  for (const [code, phrase] of [
    ["UND_ERR_CONNECT_TIMEOUT", "연결을 제한 시간 안에 맺지 못했습니다"],
    ["UND_ERR_HEADERS_TIMEOUT", "HTTP 응답 헤더"],
    ["UND_ERR_BODY_TIMEOUT", "응답 본문을 읽다가"],
  ]) {
    const f = fixture(t, {
      env: { ...env, KNOX_MAIL_TIMEOUT_MS: "30000" },
      fetchImpl: async (_, { signal }) => {
        assert.equal(signal.aborted, false)
        throw Object.assign(new TypeError("private connection detail"), { cause: { code } })
      },
    })
    const body = draft()
    const result = await call(f.handler, { body })
    assert.equal(result.body.code, "MAIL_RESULT_UNKNOWN")
    assert.equal(result.body.diagnostics.networkCode, code)
    assert.equal(result.body.diagnostics.timeoutMs, 30000)
    assert.ok(result.body.error.includes(phrase))
    assert.doesNotMatch(result.body.error, /설정된 전체 제한 시간은 30초|private/)
    assert.equal(result.body.diagnostics.upstreamStatus, undefined)
    assert.equal((await call(f.handler, { body })).body.diagnostics.networkCode, code)
  }
})
