import assert from "node:assert/strict"
import test from "node:test"
import { createMailingReportDataHandler } from "./mailingReportData.mjs"

const key = "synthetic-mailing-report-key-for-tests-only"
const path = "/api/mailing-report/dashboard-data"

function harness({ configuredKey = key, ssoEnabled = true } = {}) {
  const calls = []
  const handle = createMailingReportDataHandler({
    env: { MAILING_REPORT_API_KEY: configuredKey },
    ssoConfig: { enabled: ssoEnabled, trustedProxies: ["127.0.0.1"] },
    dashboardHandler: async (req, res, url) => {
      calls.push({ method: req.method, filters: [...url.searchParams] })
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ ok: true, lineDashboard: { mailingSummary: [] } }))
    },
  })
  return {
    calls,
    async request({ url = path, method = "GET", peer = "::ffff:127.0.0.1", headers = {}, rawHeaders = [] } = {}) {
      const req = { url, method, socket: { remoteAddress: peer }, rawHeaders, headers: { "x-forwarded-proto": "https", ...headers } }
      const res = {
        headers: {},
        setHeader(name, value) { this.headers[name.toLowerCase()] = value },
        writeHead(status, values) { this.status = status; Object.entries(values).forEach(([name, value]) => this.setHeader(name, value)) },
        end(body) { this.body = body ?? "" },
      }
      const handled = await handle(req, res)
      return { handled, ...res }
    },
  }
}

const authorized = { authorization: `Bearer ${key}` }

test("키가 없거나 형식이 잘못되면 데이터에 접근하지 않는다", async () => {
  for (const configuredKey of ["", "short", "a".repeat(257), " ".repeat(32), `${key}\n`]) {
    const h = harness({ configuredKey })
    const res = await h.request({ headers: authorized })
    assert.equal(res.status, 503)
    assert.equal(JSON.parse(res.body).code, "MAILING_REPORT_API_DISABLED")
    assert.equal(res.headers["cache-control"], "no-store")
    assert.equal(h.calls.length, 0)
  }
})

test("쿠키, 사용자 헤더, URL의 키로는 인증할 수 없고 잘못된 Bearer는 거부한다", async () => {
  const h = harness()
  for (const headers of [
    {}, { cookie: "__Host-l0_spider_session=synthetic", "x-knox-id": "admin" },
    { authorization: "Bearer synthetic-invalid-key-with-sufficient-length" },
    { authorization: `Basic ${key}` }, { authorization: `Bearer ${key}, Bearer ${key}` },
  ]) {
    const res = await h.request({ url: `${path}?api_key=${key}`, headers })
    assert.equal(res.status, 401)
    assert.equal(JSON.parse(res.body).code, "MAILING_REPORT_AUTHENTICATION_REQUIRED")
    assert.equal(res.headers["www-authenticate"], "Bearer")
    assert.equal(res.body.includes(key), false)
  }
  assert.equal(h.calls.length, 0)
})

test("중복 Authorization 헤더를 거부한다", async () => {
  const h = harness()
  const res = await h.request({ headers: authorized, rawHeaders: ["Authorization", `Bearer ${key}`, "authorization", `Bearer ${key}`] })
  assert.equal(res.status, 401)
  assert.equal(h.calls.length, 0)
})

test("정확한 메일 API만 처리하고 다른 경로는 기존 인증에 넘긴다", async () => {
  const h = harness()
  for (const url of ["/api/dashboard-data", "/api/current-user", "/api/chart-mail", "/auth/login", "/", `${path}/`, `${path}/extra`]) {
    const res = await h.request({ url, headers: authorized })
    assert.equal(res.handled, false, url)
    assert.equal(res.status, undefined)
  }
  assert.equal(h.calls.length, 0)
})

test("SSO 세션 없이 유효한 키로 기존 대시보드 처리기에 조회 조건을 전달한다", async () => {
  const h = harness()
  const res = await h.request({ url: `${path}?startDate=2026-09-01&endDate=2026-09-02&line=P1&line=P2`, headers: authorized })
  assert.equal(res.status, 200)
  assert.equal(res.handled, true)
  assert.equal(res.headers["cache-control"], "no-store")
  assert.deepEqual(JSON.parse(res.body), { ok: true, lineDashboard: { mailingSummary: [] } })
  assert.deepEqual(h.calls, [{ method: "GET", filters: [["startDate", "2026-09-01"], ["endDate", "2026-09-02"], ["line", "P1"], ["line", "P2"]] }])
  const head = await h.request({ method: "HEAD", headers: authorized })
  assert.equal(head.status, 200)
  assert.equal(head.body, "")
})

test("유효한 키로도 쓰기 요청은 허용하지 않는다", async () => {
  const h = harness()
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const res = await h.request({ method, headers: authorized })
    assert.equal(res.status, 405)
    assert.equal(res.headers.allow, "GET, HEAD")
  }
  assert.equal(h.calls.length, 0)
})

test("SSO 운영의 HTTPS와 신뢰 프록시 조건을 키로 우회할 수 없다", async () => {
  const h = harness()
  for (const options of [
    { peer: "192.0.2.1", headers: authorized },
    { headers: { ...authorized, "x-forwarded-proto": "http" } },
    { headers: { ...authorized, "x-forwarded-proto": undefined } },
    { headers: { ...authorized, "x-forwarded-proto": "https,http" } },
  ]) {
    const res = await h.request(options)
    assert.equal(res.status, 400)
    assert.equal(JSON.parse(res.body).code, "SSO_PROXY_REQUIRED")
  }
  assert.equal(h.calls.length, 0)
})

test("SSO 비활성 환경에서도 전용 API는 키를 요구하며 HEAD 오류 본문은 비운다", async () => {
  const h = harness({ ssoEnabled: false })
  assert.equal((await h.request({ headers: { "x-forwarded-proto": undefined } })).status, 401)
  assert.equal((await h.request({ headers: { ...authorized, "x-forwarded-proto": undefined } })).status, 200)
  const res = await h.request({ method: "HEAD" })
  assert.equal(res.status, 401)
  assert.equal(res.body, "")
})
